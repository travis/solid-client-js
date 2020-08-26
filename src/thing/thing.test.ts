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

import { describe, it, expect } from "@jest/globals";
import { dataset } from "@rdfjs/dataset";
import { NamedNode } from "rdf-js";
import { DataFactory } from "n3";
import {
  getThing,
  getThingAll,
  setThing,
  removeThing,
  createThing,
  asUrl,
  internal_toNode,
  isThing,
  getReadableThing,
} from "./thing";
import {
  IriString,
  Thing,
  ThingLocal,
  ThingPersisted,
  SolidDataset,
  WithResourceInfo,
  WithChangeLog,
  LocalNode,
  WithAcl,
  AclDataset,
} from "../interfaces";
import { createSolidDataset } from "../resource/solidDataset";
import { mockThingFrom } from "./mock";
import {
  addStringNoLocale,
  addInteger,
  addStringWithLocale,
  addIri,
} from "./add";

function getMockQuad(
  terms: Partial<{
    subject: IriString;
    predicate: IriString;
    object: IriString;
    namedGraph: IriString;
  }> = {}
) {
  const subject: NamedNode = DataFactory.namedNode(
    terms.subject ?? "https://arbitrary.vocab/subject"
  );
  const predicate: NamedNode = DataFactory.namedNode(
    terms.predicate ?? "https://arbitrary.vocab/predicate"
  );
  const object: NamedNode = DataFactory.namedNode(
    terms.object ?? "https://arbitrary.vocab/object"
  );
  const namedGraph: NamedNode | undefined = terms.namedGraph
    ? DataFactory.namedNode(terms.namedGraph)
    : undefined;
  return DataFactory.quad(subject, predicate, object, namedGraph);
}

describe("createThing", () => {
  it("automatically generates a unique name for the Thing", () => {
    const thing1: ThingLocal = createThing();
    const thing2: ThingLocal = createThing();

    expect(typeof thing1.internal_localSubject.internal_name).toBe("string");
    expect(thing1.internal_localSubject.internal_name.length).toBeGreaterThan(
      0
    );
    expect(thing1.internal_localSubject.internal_name).not.toEqual(
      thing2.internal_localSubject.internal_name
    );
  });

  it("uses the given name, if any", () => {
    const thing: ThingLocal = createThing({ name: "some-name" });

    expect(thing.internal_localSubject.internal_name).toBe("some-name");
  });

  it("uses the given IRI, if any", () => {
    const thing: ThingPersisted = createThing({
      url: "https://some.pod/resource#thing",
    });

    expect(thing.internal_url).toBe("https://some.pod/resource#thing");
  });

  it("throws an error if the given URL is invalid", () => {
    expect(() => createThing({ url: "Invalid IRI" })).toThrow();
  });
});

describe("isThing", () => {
  it("returns true for a ThingLocal", () => {
    expect(isThing(createThing())).toBe(true);
  });

  it("returns true for a ThingPersisted", () => {
    expect(isThing(mockThingFrom("https://arbitrary.pod/resource#thing"))).toBe(
      true
    );
  });

  it("returns false for an atomic data type", () => {
    expect(isThing("This is not a Thing")).toBe(false);
  });

  it("returns false for a regular JavaScript object", () => {
    expect(isThing({ not: "a Thing" })).toBe(false);
  });

  it("returns false for a plain RDF/JS Dataset", () => {
    expect(isThing(dataset())).toBe(false);
  });

  it("returns false for a SolidDataset", () => {
    expect(isThing(createSolidDataset())).toBe(false);
  });
});

describe("getThing", () => {
  it("returns a Dataset with just Quads in there with the given Subject", () => {
    const relevantQuad = getMockQuad({ subject: "https://some.vocab/subject" });
    const datasetWithMultipleThings = dataset();
    datasetWithMultipleThings.add(relevantQuad);
    datasetWithMultipleThings.add(
      getMockQuad({ subject: "https://arbitrary-other.vocab/subject" })
    );

    const thing = getThing(
      datasetWithMultipleThings,
      "https://some.vocab/subject"
    );

    expect(Array.from(thing)).toEqual([relevantQuad]);
  });

  it("accepts a Named Node as the Subject identifier", () => {
    const relevantQuad = getMockQuad({ subject: "https://some.vocab/subject" });
    const datasetWithAThing = dataset();
    datasetWithAThing.add(relevantQuad);

    const thing = getThing(
      datasetWithAThing,
      DataFactory.namedNode("https://some.vocab/subject")
    );

    expect(Array.from(thing)).toEqual([relevantQuad]);
  });

  it("accepts a LocalNode as the Subject identifier", () => {
    const quadWithLocalSubject = getMockQuad();
    const localSubject = Object.assign(
      DataFactory.blankNode("Arbitrary blank node"),
      { internal_name: "localSubject" }
    );
    quadWithLocalSubject.subject = localSubject;
    const datasetWithThingLocal = dataset();
    datasetWithThingLocal.add(quadWithLocalSubject);

    const thing = getThing(datasetWithThingLocal, localSubject);

    expect(Array.from(thing)).toEqual([quadWithLocalSubject]);
  });

  it("returns Quads from all Named Graphs if no scope was specified", () => {
    const quadInDefaultGraph = getMockQuad({
      subject: "https://some.vocab/subject",
    });
    const quadInArbitraryGraph = getMockQuad({
      subject: "https://some.vocab/subject",
      namedGraph: "https://arbitrary.vocab/namedGraph",
    });
    const datasetWithMultipleNamedGraphs = dataset();
    datasetWithMultipleNamedGraphs.add(quadInDefaultGraph);
    datasetWithMultipleNamedGraphs.add(quadInArbitraryGraph);

    const thing = getThing(
      datasetWithMultipleNamedGraphs,
      "https://some.vocab/subject"
    );

    expect(thing.size).toEqual(2);
    expect(Array.from(thing)).toContain(quadInDefaultGraph);
    expect(Array.from(thing)).toContain(quadInArbitraryGraph);
  });

  it("is able to limit the Thing's scope to a single Named Graph", () => {
    const relevantQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      namedGraph: "https://some.vocab/namedGraph",
    });
    const datasetWithMultipleNamedGraphs = dataset();
    datasetWithMultipleNamedGraphs.add(relevantQuad);
    datasetWithMultipleNamedGraphs.add(
      getMockQuad({
        subject: "https://some.vocab/subject",
        namedGraph: "https://arbitrary-other.vocab/namedGraph",
      })
    );

    const thing = getThing(
      datasetWithMultipleNamedGraphs,
      "https://some.vocab/subject",
      { scope: "https://some.vocab/namedGraph" }
    );

    expect(Array.from(thing)).toEqual([relevantQuad]);
  });

  it("ignores Quads in the default graph when specifying an explicit scope", () => {
    const relevantQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      namedGraph: "https://some.vocab/namedGraph",
    });
    const datasetWithMultipleNamedGraphs = dataset();
    datasetWithMultipleNamedGraphs.add(relevantQuad);
    datasetWithMultipleNamedGraphs.add(
      getMockQuad({
        subject: "https://some.vocab/subject",
        namedGraph: undefined,
      })
    );

    const thing = getThing(
      datasetWithMultipleNamedGraphs,
      "https://some.vocab/subject",
      { scope: "https://some.vocab/namedGraph" }
    );

    expect(Array.from(thing)).toEqual([relevantQuad]);
  });

  it("is able to specify the scope using a Named Node", () => {
    const relevantQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      namedGraph: "https://some.vocab/namedGraph",
    });
    const datasetWithMultipleNamedGraphs = dataset();
    datasetWithMultipleNamedGraphs.add(relevantQuad);
    datasetWithMultipleNamedGraphs.add(
      getMockQuad({
        subject: "https://some.vocab/subject",
        namedGraph: "https://arbitrary-other.vocab/namedGraph",
      })
    );

    const thing = getThing(
      datasetWithMultipleNamedGraphs,
      "https://some.vocab/subject",
      { scope: DataFactory.namedNode("https://some.vocab/namedGraph") }
    );

    expect(Array.from(thing)).toEqual([relevantQuad]);
  });
});

describe("getThingAll", () => {
  it("returns multiple Datasets, each with Quads with the same Subject", () => {
    const thing1Quad = getMockQuad({ subject: "https://some.vocab/subject" });
    const thing2Quad = getMockQuad({
      subject: "https://some-other.vocab/subject",
    });
    const datasetWithMultipleThings = dataset();
    datasetWithMultipleThings.add(thing1Quad);
    datasetWithMultipleThings.add(thing2Quad);

    const things = getThingAll(datasetWithMultipleThings);

    expect(Array.from(things[0])).toEqual([thing1Quad]);
    expect(Array.from(things[1])).toEqual([thing2Quad]);
  });

  it("returns one Thing per unique Subject", () => {
    const thing1Quad1 = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/object1",
    });
    const thing1Quad2 = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/object2",
    });
    const thing2Quad = getMockQuad({
      subject: "https://some-other.vocab/subject",
    });
    const datasetWithMultipleThings = dataset();
    datasetWithMultipleThings.add(thing1Quad1);
    datasetWithMultipleThings.add(thing1Quad2);
    datasetWithMultipleThings.add(thing2Quad);

    const things = getThingAll(datasetWithMultipleThings);

    expect(things).toHaveLength(2);
    expect(Array.from(things[0])).toEqual([thing1Quad1, thing1Quad2]);
    expect(Array.from(things[1])).toEqual([thing2Quad]);
  });

  it("returns Quads from all Named Graphs if no scope was specified", () => {
    const quadInDefaultGraph = getMockQuad({
      subject: "https://some.vocab/subject",
    });
    const quadInArbitraryGraph = getMockQuad({
      subject: "https://some.vocab/subject",
      namedGraph: "https://arbitrary.vocab/namedGraph",
    });
    const datasetWithMultipleNamedGraphs = dataset();
    datasetWithMultipleNamedGraphs.add(quadInDefaultGraph);
    datasetWithMultipleNamedGraphs.add(quadInArbitraryGraph);

    const things = getThingAll(datasetWithMultipleNamedGraphs);

    expect(Array.from(things[0])).toContain(quadInDefaultGraph);
    expect(Array.from(things[0])).toContain(quadInArbitraryGraph);
  });

  it("is able to limit the Things' scope to a single Named Graph", () => {
    const relevantQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      namedGraph: "https://some.vocab/namedGraph",
    });
    const datasetWithMultipleNamedGraphs = dataset();
    datasetWithMultipleNamedGraphs.add(relevantQuad);
    datasetWithMultipleNamedGraphs.add(
      getMockQuad({
        subject: "https://some.vocab/subject",
        namedGraph: "https://arbitrary-other.vocab/namedGraph",
      })
    );

    const things = getThingAll(datasetWithMultipleNamedGraphs, {
      scope: "https://some.vocab/namedGraph",
    });

    expect(Array.from(things[0])).toEqual([relevantQuad]);
  });

  it("ignores Quads in the default graph when specifying an explicit scope", () => {
    const relevantQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      namedGraph: "https://some.vocab/namedGraph",
    });
    const datasetWithMultipleNamedGraphs = dataset();
    datasetWithMultipleNamedGraphs.add(relevantQuad);
    datasetWithMultipleNamedGraphs.add(
      getMockQuad({
        subject: "https://some.vocab/subject",
        namedGraph: undefined,
      })
    );

    const things = getThingAll(datasetWithMultipleNamedGraphs, {
      scope: "https://some.vocab/namedGraph",
    });

    expect(Array.from(things[0])).toEqual([relevantQuad]);
  });

  it("is able to specify the scope using a Named Node", () => {
    const relevantQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      namedGraph: "https://some.vocab/namedGraph",
    });
    const datasetWithMultipleNamedGraphs = dataset();
    datasetWithMultipleNamedGraphs.add(relevantQuad);
    datasetWithMultipleNamedGraphs.add(
      getMockQuad({
        subject: "https://some.vocab/subject",
        namedGraph: "https://arbitrary-other.vocab/namedGraph",
      })
    );

    const things = getThingAll(datasetWithMultipleNamedGraphs, {
      scope: DataFactory.namedNode("https://some.vocab/namedGraph"),
    });

    expect(Array.from(things[0])).toEqual([relevantQuad]);
  });

  it("only returns Things whose Subject has an IRI, or is a LocalNode", () => {
    const quadWithNamedSubject = getMockQuad({
      subject: "https://some.vocab/subject",
    });
    const quadWithBlankSubject = getMockQuad();
    quadWithBlankSubject.subject = DataFactory.blankNode(
      "Arbitrary blank node"
    );
    const quadWithLocalSubject = getMockQuad();
    const localSubject = Object.assign(
      DataFactory.blankNode("Blank node representing a LocalNode"),
      { internal_name: "localSubject" }
    );
    quadWithLocalSubject.subject = localSubject;
    const datasetWithMultipleThings = dataset();
    datasetWithMultipleThings.add(quadWithNamedSubject);
    datasetWithMultipleThings.add(quadWithBlankSubject);
    datasetWithMultipleThings.add(quadWithLocalSubject);

    const things = getThingAll(datasetWithMultipleThings);

    expect(things).toHaveLength(2);
    expect(Array.from(things[0])).toEqual([quadWithNamedSubject]);
    expect(Array.from(things[1])).toEqual([quadWithLocalSubject]);
  });
});

describe("setThing", () => {
  it("returns a Dataset with only the Thing's Quads having the Thing's Subject", () => {
    const oldThingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/old-object",
    });
    const otherQuad = getMockQuad({
      subject: "https://arbitrary-other.vocab/subject",
    });
    const datasetWithMultipleThings = dataset();
    datasetWithMultipleThings.add(oldThingQuad);
    datasetWithMultipleThings.add(otherQuad);

    const newThingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/new-object",
    });
    const newThing: Thing = Object.assign(dataset(), {
      internal_url: "https://some.vocab/subject",
    });
    newThing.add(newThingQuad);

    const updatedDataset = setThing(datasetWithMultipleThings, newThing);

    expect(Array.from(updatedDataset)).toEqual([otherQuad, newThingQuad]);
  });

  it("keeps track of additions and deletions in the attached change log", () => {
    const oldThingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/old-object",
    });
    const otherQuad = getMockQuad({
      subject: "https://arbitrary-other.vocab/subject",
    });
    const datasetWithMultipleThings = dataset();
    datasetWithMultipleThings.add(oldThingQuad);
    datasetWithMultipleThings.add(otherQuad);

    const newThingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/new-object",
    });
    const newThing: Thing = Object.assign(dataset(), {
      internal_url: "https://some.vocab/subject",
    });
    newThing.add(newThingQuad);

    const updatedDataset = setThing(datasetWithMultipleThings, newThing);

    expect(updatedDataset.internal_changeLog.additions).toEqual([newThingQuad]);
    expect(updatedDataset.internal_changeLog.deletions).toEqual([oldThingQuad]);
  });

  it("reconciles deletions and additions in the change log", () => {
    const oldThingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/old-object",
    });
    const otherQuad = getMockQuad({
      subject: "https://arbitrary-other.vocab/subject",
    });
    const addedQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/previously-added-object",
    });
    const deletedQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/previously-deleted-object",
    });
    const datasetWithMultipleThings = dataset();
    datasetWithMultipleThings.add(oldThingQuad);
    datasetWithMultipleThings.add(otherQuad);
    datasetWithMultipleThings.add(addedQuad);
    const datasetWithExistingChangeLog = Object.assign(
      datasetWithMultipleThings,
      {
        internal_changeLog: {
          additions: [addedQuad],
          deletions: [deletedQuad],
        },
      }
    );

    const newThingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/new-object",
    });
    const newThing: Thing = Object.assign(dataset(), {
      internal_url: "https://some.vocab/subject",
    });
    newThing.add(newThingQuad);
    newThing.add(deletedQuad);

    const updatedDataset = setThing(datasetWithExistingChangeLog, newThing);

    expect(updatedDataset.internal_changeLog.additions).toEqual([newThingQuad]);
    expect(updatedDataset.internal_changeLog.deletions).toEqual([oldThingQuad]);
  });

  it("preserves existing change logs", () => {
    const oldThingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/old-object",
    });
    const otherQuad = getMockQuad({
      subject: "https://arbitrary-other.vocab/subject",
    });
    const existingAddition = getMockQuad({
      object: "https://some.vocab/addition-object",
    });
    const existingDeletion = getMockQuad({
      object: "https://some.vocab/deletion-object",
    });
    const datasetWithExistingChangeLog: SolidDataset &
      WithChangeLog = Object.assign(dataset(), {
      internal_changeLog: {
        additions: [existingAddition],
        deletions: [existingDeletion],
      },
    });
    datasetWithExistingChangeLog.add(oldThingQuad);
    datasetWithExistingChangeLog.add(otherQuad);

    const newThingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/new-object",
    });
    const newThing: Thing = Object.assign(dataset(), {
      internal_url: "https://some.vocab/subject",
    });
    newThing.add(newThingQuad);

    const updatedDataset = setThing(datasetWithExistingChangeLog, newThing);

    expect(updatedDataset.internal_changeLog.additions).toEqual([
      existingAddition,
      newThingQuad,
    ]);
    expect(updatedDataset.internal_changeLog.deletions).toEqual([
      existingDeletion,
      oldThingQuad,
    ]);
  });

  it("does not modify the original SolidDataset", () => {
    const oldThingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/old-object",
    });
    const otherQuad = getMockQuad({
      subject: "https://arbitrary-other.vocab/subject",
    });
    const existingAddition = getMockQuad({
      object: "https://some.vocab/addition-object",
    });
    const existingDeletion = getMockQuad({
      object: "https://some.vocab/deletion-object",
    });
    const datasetWithExistingChangeLog: SolidDataset &
      WithChangeLog = Object.assign(dataset(), {
      internal_changeLog: {
        additions: [existingAddition],
        deletions: [existingDeletion],
      },
    });
    datasetWithExistingChangeLog.add(oldThingQuad);
    datasetWithExistingChangeLog.add(otherQuad);

    const newThingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/new-object",
    });
    const newThing: Thing = Object.assign(dataset(), {
      internal_url: "https://some.vocab/subject",
    });
    newThing.add(newThingQuad);

    setThing(datasetWithExistingChangeLog, newThing);

    expect(Array.from(datasetWithExistingChangeLog)).toEqual([
      oldThingQuad,
      otherQuad,
    ]);
    expect(datasetWithExistingChangeLog.internal_changeLog.additions).toEqual([
      existingAddition,
    ]);
    expect(datasetWithExistingChangeLog.internal_changeLog.deletions).toEqual([
      existingDeletion,
    ]);
  });

  it("does not modify Quads with unexpected Subjects", () => {
    const unexpectedQuad = DataFactory.quad(
      DataFactory.variable("Arbitrary unexpected Subject type"),
      DataFactory.namedNode("https://arbitrary.vocab/predicate"),
      DataFactory.namedNode("https://arbitrary.vocab/object")
    );
    const datasetWithUnexpectedQuad = dataset();
    datasetWithUnexpectedQuad.add(unexpectedQuad);

    const thing: Thing = Object.assign(dataset(), {
      internal_url: "https://arbitrary.vocab/subject",
    });

    const updatedDataset = setThing(datasetWithUnexpectedQuad, thing);

    expect(Array.from(updatedDataset)).toEqual([unexpectedQuad]);
  });

  it("can recognise LocalNodes", () => {
    const localSubject = Object.assign(
      DataFactory.blankNode("Blank node representing a LocalNode"),
      { internal_name: "localSubject" }
    );
    const mockPredicate = DataFactory.namedNode(
      "https://arbitrary.vocab/predicate"
    );
    const oldThingQuad = DataFactory.quad(
      localSubject,
      mockPredicate,
      DataFactory.namedNode("https://some.vocab/old-object")
    );
    const datasetWithLocalSubject = dataset();
    datasetWithLocalSubject.add(oldThingQuad);

    const newThingQuad = DataFactory.quad(
      localSubject,
      mockPredicate,
      DataFactory.namedNode("https://some.vocab/new-object")
    );
    const newThing: Thing = Object.assign(dataset(), {
      internal_localSubject: localSubject,
    });
    newThing.add(newThingQuad);

    const updatedDataset = setThing(datasetWithLocalSubject, newThing);

    expect(Array.from(updatedDataset)).toEqual([newThingQuad]);
  });

  it("can reconcile new LocalNodes with existing NamedNodes if the SolidDataset has a resource IRI attached", () => {
    const oldThingQuad = getMockQuad({
      subject: "https://some.pod/resource#subject",
      object: "https://some.vocab/old-object",
    });
    const datasetWithNamedNode: SolidDataset & WithResourceInfo = Object.assign(
      dataset(),
      {
        internal_resourceInfo: {
          sourceIri: "https://some.pod/resource",
          isRawData: false,
        },
      }
    );
    datasetWithNamedNode.add(oldThingQuad);

    const localSubject = Object.assign(
      DataFactory.blankNode("Blank node representing a LocalNode"),
      { internal_name: "subject" }
    );
    const mockPredicate = DataFactory.namedNode(
      "https://arbitrary.vocab/predicate"
    );
    const newThingQuad = DataFactory.quad(
      localSubject,
      mockPredicate,
      DataFactory.namedNode("https://some.vocab/new-object")
    );
    const newThing: Thing = Object.assign(dataset(), {
      internal_localSubject: localSubject,
    });
    newThing.add(newThingQuad);

    const updatedDataset = setThing(datasetWithNamedNode, newThing);

    expect(Array.from(updatedDataset)).toEqual([newThingQuad]);
  });

  it("can reconcile new NamedNodes with existing LocalNodes if the SolidDataset has a resource IRI attached", () => {
    const localSubject = Object.assign(
      DataFactory.blankNode("Blank node representing a LocalNode"),
      { internal_name: "subject" }
    );
    const mockPredicate = DataFactory.namedNode(
      "https://arbitrary.vocab/predicate"
    );
    const oldThingQuad = DataFactory.quad(
      localSubject,
      mockPredicate,
      DataFactory.namedNode("https://some.vocab/new-object")
    );
    const datasetWithLocalSubject: SolidDataset &
      WithResourceInfo = Object.assign(dataset(), {
      internal_resourceInfo: {
        sourceIri: "https://some.pod/resource",
        isRawData: false,
      },
    });
    datasetWithLocalSubject.add(oldThingQuad);

    const newThingQuad = getMockQuad({
      subject: "https://some.pod/resource#subject",
      object: "https://some.vocab/old-object",
    });
    const newThing: Thing = Object.assign(dataset(), {
      internal_localSubject: localSubject,
    });
    newThing.add(newThingQuad);

    const updatedDataset = setThing(datasetWithLocalSubject, newThing);

    expect(Array.from(updatedDataset)).toEqual([newThingQuad]);
  });

  it("only updates LocalNodes if the SolidDataset has no known IRI", () => {
    const localSubject = Object.assign(
      DataFactory.blankNode("Blank node representing a LocalNode"),
      { internal_name: "localSubject" }
    );
    const mockPredicate = DataFactory.namedNode(
      "https://arbitrary.vocab/predicate"
    );
    const oldThingQuad = DataFactory.quad(
      localSubject,
      mockPredicate,
      DataFactory.namedNode("https://some.vocab/old-object")
    );
    const similarSubjectQuad = getMockQuad({
      subject: "https://some.pod/resource#localSubject",
    });
    const datasetWithLocalSubject = dataset();
    datasetWithLocalSubject.add(oldThingQuad);
    datasetWithLocalSubject.add(similarSubjectQuad);

    const newThingQuad = DataFactory.quad(
      localSubject,
      mockPredicate,
      DataFactory.namedNode("https://some.vocab/new-object")
    );
    const newThing: Thing = Object.assign(dataset(), {
      internal_localSubject: localSubject,
    });
    newThing.add(newThingQuad);

    const updatedDataset = setThing(datasetWithLocalSubject, newThing);

    expect(Array.from(updatedDataset)).toEqual([
      similarSubjectQuad,
      newThingQuad,
    ]);
  });
});

describe("removeThing", () => {
  it("returns a Dataset that excludes Quads with the Thing's Subject", () => {
    const thingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/new-object",
    });
    const sameSubjectQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/old-object",
    });
    const otherQuad = getMockQuad({
      subject: "https://arbitrary-other.vocab/subject",
    });
    const datasetWithMultipleThings = dataset();
    datasetWithMultipleThings.add(thingQuad);
    datasetWithMultipleThings.add(sameSubjectQuad);
    datasetWithMultipleThings.add(otherQuad);

    const thing: Thing = Object.assign(dataset(), {
      internal_url: "https://some.vocab/subject",
    });
    thing.add(thingQuad);

    const updatedDataset = removeThing(datasetWithMultipleThings, thing);

    expect(Array.from(updatedDataset)).toEqual([otherQuad]);
  });

  it("keeps track of deletions in the attached change log", () => {
    const thingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/new-object",
    });
    const sameSubjectQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/old-object",
    });
    const otherQuad = getMockQuad({
      subject: "https://arbitrary-other.vocab/subject",
    });
    const datasetWithMultipleThings = dataset();
    datasetWithMultipleThings.add(thingQuad);
    datasetWithMultipleThings.add(sameSubjectQuad);
    datasetWithMultipleThings.add(otherQuad);

    const thing: Thing = Object.assign(dataset(), {
      internal_url: "https://some.vocab/subject",
    });
    thing.add(thingQuad);

    const updatedDataset = removeThing(datasetWithMultipleThings, thing);

    expect(updatedDataset.internal_changeLog.additions).toEqual([]);
    expect(updatedDataset.internal_changeLog.deletions).toHaveLength(2);
    expect(updatedDataset.internal_changeLog.deletions).toContain(
      sameSubjectQuad
    );
    expect(updatedDataset.internal_changeLog.deletions).toContain(thingQuad);
  });

  it("reconciles deletions in the change log with additions", () => {
    const thingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/new-object",
    });
    const sameSubjectQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/old-object",
    });
    const otherQuad = getMockQuad({
      subject: "https://arbitrary-other.vocab/subject",
    });
    const datasetWithMultipleThings = dataset();
    datasetWithMultipleThings.add(thingQuad);
    datasetWithMultipleThings.add(sameSubjectQuad);
    datasetWithMultipleThings.add(otherQuad);
    const datasetWithChangelog = Object.assign(datasetWithMultipleThings, {
      internal_changeLog: {
        additions: [thingQuad],
        deletions: [],
      },
    });

    const thing: Thing = Object.assign(dataset(), {
      internal_url: "https://some.vocab/subject",
    });
    thing.add(thingQuad);

    const updatedDataset = removeThing(datasetWithChangelog, thing);

    expect(updatedDataset.internal_changeLog.additions).toEqual([]);
    expect(updatedDataset.internal_changeLog.deletions).toHaveLength(1);
    expect(updatedDataset.internal_changeLog.deletions).toContain(
      sameSubjectQuad
    );
  });

  it("preserves existing change logs", () => {
    const thingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/new-object",
    });
    const existingAddition = getMockQuad({
      object: "https://some.vocab/addition-object",
    });
    const existingDeletion = getMockQuad({
      object: "https://some.vocab/deletion-object",
    });
    const datasetWithExistingChangeLog: SolidDataset &
      WithChangeLog = Object.assign(dataset(), {
      internal_changeLog: {
        additions: [existingAddition],
        deletions: [existingDeletion],
      },
    });
    datasetWithExistingChangeLog.add(thingQuad);

    const thing: Thing = Object.assign(dataset(), {
      internal_url: "https://some.vocab/subject",
    });
    thing.add(thingQuad);

    const updatedDataset = removeThing(datasetWithExistingChangeLog, thing);

    expect(updatedDataset.internal_changeLog.additions).toEqual([
      existingAddition,
    ]);
    expect(updatedDataset.internal_changeLog.deletions).toEqual([
      existingDeletion,
      thingQuad,
    ]);
  });

  it("preserves attached ACLs", () => {
    const thingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/new-object",
    });
    const datasetWithFetchedAcls: SolidDataset & WithAcl = Object.assign(
      dataset(),
      {
        internal_acl: {
          resourceAcl: null,
          fallbackAcl: null,
        },
      }
    );
    datasetWithFetchedAcls.add(thingQuad);

    const thing: Thing = Object.assign(dataset(), {
      internal_url: "https://some.vocab/subject",
    });
    thing.add(thingQuad);

    const updatedDataset = removeThing(datasetWithFetchedAcls, thing);

    expect(updatedDataset.internal_acl).toEqual({
      resourceAcl: null,
      fallbackAcl: null,
    });
  });

  it("preserves metadata on ACL Datasets", () => {
    const thingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/new-object",
    });
    const aclDataset: AclDataset = Object.assign(dataset(), {
      internal_accessTo: "https://arbitrary.pod/resource",
      internal_resourceInfo: {
        sourceIri: "https://arbitrary.pod/resource.acl",
        isRawData: false,
      },
    });
    aclDataset.add(thingQuad);

    const thing: Thing = Object.assign(dataset(), {
      internal_url: "https://some.vocab/subject",
    });
    thing.add(thingQuad);

    const updatedDataset = removeThing(aclDataset, thing);

    expect(updatedDataset.internal_accessTo).toBe(
      "https://arbitrary.pod/resource"
    );
    expect(updatedDataset.internal_resourceInfo).toEqual({
      sourceIri: "https://arbitrary.pod/resource.acl",
      isRawData: false,
    });
  });

  it("returns a Dataset that excludes Quads with a given Subject IRI", () => {
    const thingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/new-object",
    });
    const otherQuad = getMockQuad({
      subject: "https://arbitrary-other.vocab/subject",
    });
    const datasetWithMultipleThings = dataset();
    datasetWithMultipleThings.add(thingQuad);
    datasetWithMultipleThings.add(otherQuad);

    const updatedDataset = removeThing(
      datasetWithMultipleThings,
      "https://some.vocab/subject"
    );

    expect(Array.from(updatedDataset)).toEqual([otherQuad]);
    expect(updatedDataset.internal_changeLog.deletions).toEqual([thingQuad]);
  });

  it("does not modify the original SolidDataset", () => {
    const thingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/new-object",
    });
    const otherQuad = getMockQuad({
      subject: "https://arbitrary-other.vocab/subject",
    });
    const datasetWithMultipleThings = dataset();
    datasetWithMultipleThings.add(thingQuad);
    datasetWithMultipleThings.add(otherQuad);

    removeThing(datasetWithMultipleThings, "https://some.vocab/subject");

    expect(Array.from(datasetWithMultipleThings)).toEqual([
      thingQuad,
      otherQuad,
    ]);
    expect(
      (datasetWithMultipleThings as SolidDataset & WithChangeLog)
        .internal_changeLog
    ).toBeUndefined();
  });

  it("does not modify Quads with unexpected Subjects", () => {
    const unexpectedQuad = DataFactory.quad(
      DataFactory.variable("Arbitrary unexpected Subject type"),
      DataFactory.namedNode("https://arbitrary.vocab/predicate"),
      DataFactory.namedNode("https://arbitrary.vocab/object")
    );
    const datasetWithUnexpectedQuad = dataset();
    datasetWithUnexpectedQuad.add(unexpectedQuad);

    const thing: Thing = Object.assign(dataset(), {
      internal_url: "https://arbitrary.vocab/subject",
    });

    const updatedDataset = removeThing(datasetWithUnexpectedQuad, thing);

    expect(Array.from(updatedDataset)).toEqual([unexpectedQuad]);
  });

  it("returns a Dataset that excludes Quads with a given NamedNode as their Subject", () => {
    const thingQuad = getMockQuad({
      subject: "https://some.vocab/subject",
      object: "https://some.vocab/new-object",
    });
    const otherQuad = getMockQuad({
      subject: "https://arbitrary-other.vocab/subject",
    });
    const datasetWithMultipleThings = dataset();
    datasetWithMultipleThings.add(thingQuad);
    datasetWithMultipleThings.add(otherQuad);

    const updatedDataset = removeThing(
      datasetWithMultipleThings,
      DataFactory.namedNode("https://some.vocab/subject")
    );

    expect(Array.from(updatedDataset)).toEqual([otherQuad]);
    expect(updatedDataset.internal_changeLog.deletions).toEqual([thingQuad]);
  });

  it("can recognise LocalNodes", () => {
    const localSubject = Object.assign(
      DataFactory.blankNode("Blank node representing a LocalNode"),
      { internal_name: "localSubject" }
    );
    const mockPredicate = DataFactory.namedNode(
      "https://arbitrary.vocab/predicate"
    );
    const thingQuad = DataFactory.quad(
      localSubject,
      mockPredicate,
      DataFactory.namedNode("https://some.vocab/old-object")
    );
    const datasetWithMultipleThings = dataset();
    datasetWithMultipleThings.add(thingQuad);

    const updatedDataset = removeThing(datasetWithMultipleThings, localSubject);

    expect(Array.from(updatedDataset)).toEqual([]);
    expect(updatedDataset.internal_changeLog.deletions).toEqual([thingQuad]);
  });

  it("can reconcile given LocalNodes with existing NamedNodes if the SolidDataset has a resource IRI attached", () => {
    const oldThingQuad = getMockQuad({
      subject: "https://some.pod/resource#subject",
      object: "https://some.vocab/old-object",
    });
    const datasetWithNamedNode: SolidDataset & WithResourceInfo = Object.assign(
      dataset(),
      {
        internal_resourceInfo: {
          sourceIri: "https://some.pod/resource",
          isRawData: false,
        },
      }
    );
    datasetWithNamedNode.add(oldThingQuad);

    const localSubject = Object.assign(
      DataFactory.blankNode("Blank node representing a LocalNode"),
      { internal_name: "subject" }
    );

    const updatedDataset = removeThing(datasetWithNamedNode, localSubject);

    expect(Array.from(updatedDataset)).toEqual([]);
  });

  it("can reconcile given NamedNodes with existing LocalNodes if the SolidDataset has a resource IRI attached", () => {
    const localSubject = Object.assign(
      DataFactory.blankNode("Blank node representing a LocalNode"),
      { internal_name: "subject" }
    );
    const mockPredicate = DataFactory.namedNode(
      "https://arbitrary.vocab/predicate"
    );
    const thingQuad = DataFactory.quad(
      localSubject,
      mockPredicate,
      DataFactory.namedNode("https://some.vocab/new-object")
    );
    const datasetWithLocalNode: SolidDataset & WithResourceInfo = Object.assign(
      dataset(),
      {
        internal_resourceInfo: {
          sourceIri: "https://some.pod/resource",
          isRawData: false,
        },
      }
    );
    datasetWithLocalNode.add(thingQuad);

    const updatedDataset = removeThing(
      datasetWithLocalNode,
      DataFactory.namedNode("https://some.pod/resource#subject")
    );

    expect(Array.from(updatedDataset)).toEqual([]);
  });

  it("only removes LocalNodes if the SolidDataset has no known IRI", () => {
    const localSubject = Object.assign(
      DataFactory.blankNode("Blank node representing a LocalNode"),
      { internal_name: "localSubject" }
    );
    const mockPredicate = DataFactory.namedNode(
      "https://arbitrary.vocab/predicate"
    );
    const thingQuad = DataFactory.quad(
      localSubject,
      mockPredicate,
      DataFactory.namedNode("https://some.vocab/old-object")
    );
    const similarSubjectQuad = getMockQuad({
      subject: "https://some.pod/resource#localSubject",
    });
    const datasetWithMultipleThings = dataset();
    datasetWithMultipleThings.add(thingQuad);
    datasetWithMultipleThings.add(similarSubjectQuad);

    const updatedDataset = removeThing(datasetWithMultipleThings, localSubject);

    expect(Array.from(updatedDataset)).toEqual([similarSubjectQuad]);
    expect(updatedDataset.internal_changeLog.deletions).toEqual([thingQuad]);
  });
});

describe("asIri", () => {
  it("returns the IRI of a persisted Thing", () => {
    const persistedThing: Thing = Object.assign(dataset(), {
      internal_url: "https://some.pod/resource#thing",
    });

    expect(asUrl(persistedThing)).toBe("https://some.pod/resource#thing");
  });

  it("returns the IRI of a local Thing relative to a given base IRI", () => {
    const localSubject: LocalNode = Object.assign(DataFactory.blankNode(), {
      internal_name: "some-name",
    });
    const localThing = Object.assign(dataset(), {
      internal_localSubject: localSubject,
    });

    expect(asUrl(localThing, "https://some.pod/resource")).toBe(
      "https://some.pod/resource#some-name"
    );
  });

  it("throws an error when a local Thing was given without a base IRI", () => {
    const localSubject: LocalNode = Object.assign(DataFactory.blankNode(), {
      internal_name: "some-name",
    });
    const localThing = Object.assign(dataset(), {
      internal_localSubject: localSubject,
    });

    expect(() => asUrl(localThing, undefined as any)).toThrow(
      "The URL of a Thing that has not been persisted cannot be determined without a base URL."
    );
  });
});

describe("toNode", () => {
  it("should result in equal LocalNodes for the same ThingLocal", () => {
    const localSubject: LocalNode = Object.assign(
      DataFactory.blankNode("Arbitrary blank node"),
      { internal_name: "localSubject" }
    );
    const thing: ThingLocal = Object.assign(dataset(), {
      internal_localSubject: localSubject,
    });
    const node1 = internal_toNode(thing);
    const node2 = internal_toNode(thing);
    expect(node1.equals(node2)).toBe(true);
  });
});

describe("getReadableThing", () => {
  it("returns a readable version of an empty, unsaved Thing", () => {
    const emptyThing = createThing({ name: "empty-thing" });

    expect(getReadableThing(emptyThing)).toBe(
      "## Thing (no URL yet — identifier: `#empty-thing`)\n" + "\n" + "<empty>"
    );
  });

  it("returns a readable version of an empty Thing with a known URL", () => {
    const emptyThing = mockThingFrom("https://some.pod/resource#thing");

    expect(getReadableThing(emptyThing)).toBe(
      "## Thing: https://some.pod/resource#thing\n" + "\n" + "<empty>"
    );
  });

  it("returns a readable version of a Thing with just one property", () => {
    let thingWithValue = createThing({ name: "with-one-value" });
    thingWithValue = addStringNoLocale(
      thingWithValue,
      "https://some.vocab/predicate",
      "Some value"
    );

    expect(getReadableThing(thingWithValue)).toBe(
      "## Thing (no URL yet — identifier: `#with-one-value`)\n" +
        "\n" +
        "https://some.vocab/predicate\n" +
        '- "Some value" (string)\n'
    );
  });

  it("returns a readable version of a Thing with multiple properties and values", () => {
    let thingWithValues = createThing({ name: "with-values" });
    thingWithValues = addStringNoLocale(
      thingWithValues,
      "https://some.vocab/predicate",
      "Some value"
    );
    thingWithValues = addStringWithLocale(
      thingWithValues,
      "https://some.vocab/predicate",
      "Some other value",
      "en-GB"
    );
    thingWithValues = addInteger(
      thingWithValues,
      "https://some.vocab/predicate",
      42
    );
    thingWithValues = addIri(
      thingWithValues,
      "https://some.vocab/other-predicate",
      "https://some.url"
    );

    expect(getReadableThing(thingWithValues)).toBe(
      "## Thing (no URL yet — identifier: `#with-values`)\n" +
        "\n" +
        "https://some.vocab/predicate\n" +
        '- "Some value" (string)\n' +
        '- "Some other value" (en-GB string)\n' +
        "- 42 (integer)\n" +
        "\n" +
        "https://some.vocab/predicate\n" +
        "- <https://some.url> (URL)\n"
    );
  });

  it("returns a readable version of a Thing that points to other Things", () => {
    let thing1 = createThing({ name: "thing1" });
    const thing2 = createThing({ name: "thing2" });
    const thing3 = mockThingFrom("https://some.pod/resource#thing3");
    thing1 = addIri(thing1, "https://some.vocab/predicate", thing2);
    thing1 = addIri(thing1, "https://some.vocab/predicate", thing3);

    expect(getReadableThing(thing1)).toBe(
      "## Thing (no URL yet — identifier: `#thing1`)\n" +
        "\n" +
        "https://some.vocab/predicate\n" +
        "- <#thing2> (URL)\n" +
        "- <https://some.pod/resource#thing3> (URL)\n" +
        "\n"
    );
  });

  it("returns a readable version of a Thing with values that we do not explicitly provide convenience functions for", () => {
    const thingWithRdfValues = createThing({ name: "with-rdf-values" });
    const someBlankNode = DataFactory.blankNode("blank-node-id");
    const someLiteral = DataFactory.literal(
      "some-serialised-value",
      "https://some.vocab/datatype"
    );
    thingWithRdfValues.add(
      DataFactory.quad(
        thingWithRdfValues.internal_localSubject,
        DataFactory.namedNode("https://some.vocab/predicate"),
        someBlankNode
      )
    );
    thingWithRdfValues.add(
      DataFactory.quad(
        thingWithRdfValues.internal_localSubject,
        DataFactory.namedNode("https://some.vocab/predicate"),
        someLiteral
      )
    );

    expect(getReadableThing(thingWithRdfValues)).toBe(
      "## Thing (no URL yet — identifier: `#with-rdf-values`)\n" +
        "\n" +
        "https://some.vocab/predicate\n" +
        "- [blank-node-id] (BlankNode)\n" +
        "- [some-serialised-value] (Literal of type: https://some.vocab/datatype)\n"
    );
  });
});
