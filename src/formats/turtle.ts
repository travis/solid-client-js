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

import { Writer, Parser } from "n3";
import { Quad } from "rdf-js";
import { IriString, iriAsString } from "../interfaces";
import { DataFactory } from "../rdfjs";

/**
 * @param quads Triples that should be serialised to Turtle
 * @internal Utility method for internal use; not part of the public API.
 */
export async function triplesToTurtle(quads: Quad[]): Promise<string> {
  const format = "text/turtle";
  const writer = new Writer({ format: format });
  // Remove any potentially lingering references to Named Graphs in Quads;
  // they'll be determined by the URL the Turtle will be sent to:
  const triples = quads.map((quad) =>
    DataFactory.quad(quad.subject, quad.predicate, quad.object, undefined)
  );
  writer.addQuads(triples);
  const writePromise = new Promise<string>((resolve, reject) => {
    writer.end((error, result) => {
      /* istanbul ignore if [n3.js doesn't actually pass an error nor a result, apparently: https://github.com/rdfjs/N3.js/blob/62682e48c02d8965b4d728cb5f2cbec6b5d1b1b8/src/N3Writer.js#L290] */
      if (error) {
        return reject(error);
      }
      resolve(result);
    });
  });

  const rawTurtle = await writePromise;
  return rawTurtle;
}

/**
 * @param raw Turtle that should be parsed into Triples
 * @internal Utility method for internal use; not part of the public API.
 */
export async function turtleToTriples(
  raw: string,
  resourceIri: IriString
): Promise<Quad[]> {
  const format = "text/turtle";
  const parser = new Parser({
    format: format,
    baseIRI: iriAsString(resourceIri),
  });

  const parsingPromise = new Promise<Quad[]>((resolve, reject) => {
    const parsedTriples: Quad[] = [];
    parser.parse(raw, (error, triple, _prefixes) => {
      if (error) {
        return reject(error);
      }
      if (triple) {
        parsedTriples.push(triple);
      } else {
        resolve(parsedTriples);
      }
    });
  });

  return parsingPromise;
}
