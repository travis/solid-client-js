/**
 * Copyright 2020 Inrupt Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
 * Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { FOAF } from "@solid/lit-vocab-common-rdfext";
import {
  fetchLitDataset,
  setThing,
  getThingOne,
  getStringNoLocaleOne,
  setDatetime,
  setStringNoLocale,
  saveLitDatasetAt,
  isLitDataset,
  getContentType,
  unstable_fetchResourceInfoWithAcl,
  unstable_fetchLitDatasetWithAcl,
  unstable_hasResourceAcl,
  unstable_getPublicAccess,
  unstable_getAgentAccessOne,
  unstable_getFallbackAcl,
  unstable_getResourceAcl,
  unstable_getAgentResourceAccessOne,
  unstable_setAgentResourceAccess,
  unstable_saveAclFor,
  unstable_hasFallbackAcl,
  unstable_hasAccessibleAcl,
  unstable_createAclFromFallbackAcl,
  unstable_getPublicDefaultAccess,
  unstable_getPublicResourceAccess,
  unstable_fetchFile,
} from "./index";
import { stringAsIri } from "./interfaces";

describe("End-to-end tests", () => {
  const testWebId = stringAsIri("https://vincentt.inrupt.net/profile/card#me");

  it("should be able to read and update data in a Pod", async () => {
    const randomNick = "Random nick " + Math.random();

    const dataset = await fetchLitDataset(
      stringAsIri("https://lit-e2e-test.inrupt.net/public/lit-pod-test.ttl")
    );
    const existingThing = getThingOne(
      dataset,
      stringAsIri(
        "https://lit-e2e-test.inrupt.net/public/lit-pod-test.ttl#thing1"
      )
    );

    expect(getStringNoLocaleOne(existingThing, FOAF.name)).toEqual(
      "Thing for first end-to-end test"
    );

    let updatedThing = setDatetime(
      existingThing,
      stringAsIri("http://schema.org/dateModified"),
      new Date()
    );
    updatedThing = setStringNoLocale(updatedThing, FOAF.nick, randomNick);

    const updatedDataset = setThing(dataset, updatedThing);
    const savedDataset = await saveLitDatasetAt(
      stringAsIri("https://lit-e2e-test.inrupt.net/public/lit-pod-test.ttl"),
      updatedDataset
    );

    const savedThing = getThingOne(
      savedDataset,
      stringAsIri(
        "https://lit-e2e-test.inrupt.net/public/lit-pod-test.ttl#thing1"
      )
    );
    expect(getStringNoLocaleOne(savedThing, FOAF.name)).toEqual(
      "Thing for first end-to-end test"
    );
    expect(getStringNoLocaleOne(savedThing, FOAF.nick)).toEqual(randomNick);
  });

  it("can differentiate between RDF and non-RDF Resources", async () => {
    const rdfResourceInfo = await unstable_fetchResourceInfoWithAcl(
      stringAsIri(
        "https://lit-e2e-test.inrupt.net/public/lit-pod-resource-info-test/litdataset.ttl"
      )
    );
    const nonRdfResourceInfo = await unstable_fetchResourceInfoWithAcl(
      stringAsIri(
        "https://lit-e2e-test.inrupt.net/public/lit-pod-resource-info-test/not-a-litdataset.png"
      )
    );
    expect(isLitDataset(rdfResourceInfo)).toEqual(true);
    expect(isLitDataset(nonRdfResourceInfo)).toEqual(false);
    // Fetching both Resource and Fallback ACLs takes quite a while on a bad network connection,
    // so double Jest's default timeout of 5 seconds:
  }, 10000);

  it("should be able to read and update ACLs", async () => {
    const fakeWebId = stringAsIri(
      "https://example.com/fake-webid#" +
        Date.now().toString() +
        Math.random().toString()
    );

    const datasetWithAcl = await unstable_fetchLitDatasetWithAcl(
      stringAsIri(
        "https://lit-e2e-test.inrupt.net/public/lit-pod-acl-test/passthrough-container/resource-with-acl.ttl"
      )
    );
    const datasetWithoutAcl = await unstable_fetchLitDatasetWithAcl(
      stringAsIri(
        "https://lit-e2e-test.inrupt.net/public/lit-pod-acl-test/passthrough-container/resource-without-acl.ttl"
      )
    );

    expect(unstable_hasResourceAcl(datasetWithAcl)).toEqual(true);
    expect(unstable_hasResourceAcl(datasetWithoutAcl)).toEqual(false);
    expect(unstable_getPublicAccess(datasetWithAcl)).toEqual({
      read: true,
      append: true,
      write: true,
      control: true,
    });
    expect(unstable_getAgentAccessOne(datasetWithAcl, testWebId)).toEqual({
      read: false,
      append: true,
      write: false,
      control: false,
    });
    expect(unstable_getAgentAccessOne(datasetWithoutAcl, testWebId)).toEqual({
      read: true,
      append: false,
      write: false,
      control: false,
    });
    const fallbackAclForDatasetWithoutAcl = unstable_getFallbackAcl(
      datasetWithoutAcl
    );
    expect(fallbackAclForDatasetWithoutAcl?.accessTo).toEqual(
      stringAsIri("https://lit-e2e-test.inrupt.net/public/lit-pod-acl-test/")
    );

    if (unstable_hasResourceAcl(datasetWithAcl)) {
      const acl = unstable_getResourceAcl(datasetWithAcl);
      const updatedAcl = unstable_setAgentResourceAccess(acl, fakeWebId, {
        read: true,
        append: false,
        write: false,
        control: false,
      });
      const savedAcl = await unstable_saveAclFor(datasetWithAcl, updatedAcl);
      const fakeWebIdAccess = unstable_getAgentResourceAccessOne(
        savedAcl,
        fakeWebId
      );
      expect(fakeWebIdAccess).toEqual({
        read: true,
        append: false,
        write: false,
        control: false,
      });

      // Cleanup
      const cleanedAcl = unstable_setAgentResourceAccess(savedAcl, fakeWebId, {
        read: false,
        append: false,
        write: false,
        control: false,
      });
      await unstable_saveAclFor(datasetWithAcl, cleanedAcl);
    }
  });

  it("can copy default rules from the fallback ACL as Resource rules to a new ACL", async () => {
    const dataset = await unstable_fetchLitDatasetWithAcl(
      stringAsIri(
        "https://lit-e2e-test.inrupt.net/public/lit-pod-acl-initialisation-test/resource.ttl"
      )
    );
    if (
      unstable_hasFallbackAcl(dataset) &&
      unstable_hasAccessibleAcl(dataset) &&
      !unstable_hasResourceAcl(dataset)
    ) {
      const newResourceAcl = unstable_createAclFromFallbackAcl(dataset);
      const existingFallbackAcl = unstable_getFallbackAcl(dataset);
      expect(unstable_getPublicDefaultAccess(existingFallbackAcl)).toEqual(
        unstable_getPublicResourceAccess(newResourceAcl)
      );
    }
  });

  it("can fetch a non-RDF file and its metadata", async () => {
    const jsonFile = await unstable_fetchFile(
      "https://lit-e2e-test.inrupt.net/public/arbitrary.json"
    );

    expect(getContentType(jsonFile)).toEqual("application/json");

    const data = JSON.parse(await jsonFile.text());
    expect(data).toEqual({ arbitrary: "json data" });
  });
});
