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

import { NamedNode, Literal, Quad, Term } from "rdf-js";
import { DataFactory } from "./rdfjs";
import { IriString, LocalNode, Iri } from "./interfaces";

/**
 * IRIs of the XML Schema data types we support
 * @internal
 */
export const xmlSchemaTypes = {
  boolean: "http://www.w3.org/2001/XMLSchema#boolean",
  dateTime: "http://www.w3.org/2001/XMLSchema#dateTime",
  decimal: "http://www.w3.org/2001/XMLSchema#decimal",
  integer: "http://www.w3.org/2001/XMLSchema#integer",
  string: "http://www.w3.org/2001/XMLSchema#string",
  langString: "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString",
} as const;
/** @internal */
export type XmlSchemaTypeIri = typeof xmlSchemaTypes[keyof typeof xmlSchemaTypes];

/**
 * @internal
 * @param value Value to serialise.
 * @returns String representation of `value`.
 * @see https://www.w3.org/TR/xmlschema-2/#boolean-lexical-representation
 */
export function serializeBoolean(value: boolean): string {
  return value ? "true" : "false";
}
/**
 * @internal
 * @param value Value to deserialise.
 * @returns Deserialized boolean, or null if the given value is not a valid serialised boolean.
 * @see https://www.w3.org/TR/xmlschema-2/#boolean-lexical-representation
 */
export function deserializeBoolean(value: string): boolean | null {
  if (value === "true" || value === "1") {
    return true;
  } else if (value === "false" || value === "0") {
    return false;
  } else {
    return null;
  }
}

/**
 * @internal
 * @param value Value to serialise.
 * @returns String representation of `value`.
 * @see https://www.w3.org/TR/xmlschema-2/#dateTime-lexical-representation
 */
export function serializeDatetime(value: Date): string {
  // Although the XML Schema DateTime is not _exactly_ an ISO 8601 string
  // (see https://www.w3.org/TR/xmlschema-2/#deviantformats),
  // the deviations only affect the parsing, not the serialisation.
  // Therefore, we can just use .toISOString():
  return value.toISOString();
}
/**
 * @internal
 * @param value Value to deserialise.
 * @returns Deserialized datetime, or null if the given value is not a valid serialised datetime.
 * @see https://www.w3.org/TR/xmlschema-2/#dateTime-lexical-representation
 */
export function deserializeDatetime(literalString: string): Date | null {
  // DateTime in the format described at
  // https://www.w3.org/TR/xmlschema-2/#dateTime-lexical-representation
  // (without constraints on the value).
  // -? - An optional leading `-`.
  // \d{4,}- - Four or more digits followed by a `-` representing the year. Example: "3000-".
  // \d\d-\d\d - Two digits representing the month and two representing the day of the month,
  //             separated by a `-`. Example: "11-03".
  // T - The letter T, separating the date from the time.
  // \d\d:\d\d:\d\d - Two digits for the hour, minute and second, respectively, separated by a `:`.
  //                  Example: "13:37:42".
  // (\.\d+)? - Optionally a `.` followed by one or more digits representing milliseconds.
  //            Example: ".1337".
  // (Z|(\+|-)\d\d:\d\d) - The letter Z indicating UTC, or a `+` or `-` followed by two digits for
  //                       the hour offset and two for the minute offset, separated by a `:`.
  //                       Example: "+13:37".
  const datetimeRegEx = /-?\d{4,}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|(\+|-)\d\d:\d\d)/;
  if (!datetimeRegEx.test(literalString)) {
    return null;
  }

  const [signedDateString, rest] = literalString.split("T");
  // The date string can optionally be prefixed with `-`,
  // in which case the year is negative:
  const [yearMultiplier, dateString] =
    signedDateString.charAt(0) === "-"
      ? [-1, signedDateString.substring(1)]
      : [1, signedDateString];
  const [yearString, monthString, dayString] = dateString.split("-");
  const utcFullYear = Number.parseInt(yearString, 10) * yearMultiplier;
  const utcMonth = Number.parseInt(monthString, 10) - 1;
  const utcDate = Number.parseInt(dayString, 10);
  const [timeString, timezoneString] = splitTimeFromTimezone(rest);
  const [hourOffset, minuteOffset] = getTimezoneOffsets(timezoneString);
  const [hourString, minuteString, timeRest] = timeString.split(":");
  const utcHours = Number.parseInt(hourString, 10) + hourOffset;
  const utcMinutes = Number.parseInt(minuteString, 10) + minuteOffset;
  const [secondString, optionalMillisecondString] = timeRest.split(".");
  const utcSeconds = Number.parseInt(secondString, 10);
  const utcMilliseconds = optionalMillisecondString
    ? Number.parseInt(optionalMillisecondString, 10)
    : 0;
  const date = new Date(0);
  date.setUTCFullYear(utcFullYear);
  date.setUTCMonth(utcMonth);
  date.setUTCDate(utcDate);
  date.setUTCHours(utcHours);
  date.setUTCMinutes(utcMinutes);
  date.setUTCSeconds(utcSeconds);
  date.setUTCMilliseconds(utcMilliseconds);
  return date;
}

/**
 * @param timeString An XML Schema time string.
 * @returns A tuple [timeString, timezoneString].
 * @see https://www.w3.org/TR/xmlschema-2/#time-lexical-repr
 */
function splitTimeFromTimezone(timeString: string): [string, string] {
  if (timeString.endsWith("Z")) {
    return [timeString.substring(0, timeString.length - 1), "Z"];
  }
  const splitOnPlus = timeString.split("+");
  const splitOnMinus = timeString.split("-");
  return splitOnPlus.length > splitOnMinus.length
    ? [splitOnPlus[0], "+" + splitOnPlus[1]]
    : [splitOnMinus[0], "-" + splitOnMinus[1]];
}

/**
 * @param timezoneString Lexical representation of a time zone in XML Schema.
 * @returns A tuple of the hour and minute offset of the time zone.
 * @see https://www.w3.org/TR/xmlschema-2/#dateTime-timezones
 */
function getTimezoneOffsets(timezoneString: string): [number, number] {
  if (timezoneString === "Z") {
    return [0, 0];
  }
  const multiplier = timezoneString.charAt(0) === "+" ? 1 : -1;
  const [hourString, minuteString] = timezoneString.substring(1).split(":");
  const hours = Number.parseInt(hourString, 10);
  const minutes = Number.parseInt(minuteString, 10);
  return [hours * multiplier, minutes * multiplier];
}

/**
 * @internal
 * @param value Value to serialise.
 * @returns String representation of `value`.
 * @see https://www.w3.org/TR/xmlschema-2/#decimal-lexical-representation
 */
export function serializeDecimal(value: number): string {
  return value.toString();
}
/**
 * @internal
 * @param value Value to deserialise.
 * @returns Deserialized decimal, or null if the given value is not a valid serialised decimal.
 * @see https://www.w3.org/TR/xmlschema-2/#decimal-lexical-representation
 */
export function deserializeDecimal(literalString: string): number | null {
  const deserialized = Number.parseFloat(literalString);
  if (Number.isNaN(deserialized)) {
    return null;
  }
  return deserialized;
}

/**
 * @internal
 * @param value Value to serialise.
 * @returns String representation of `value`.
 */
export function serializeInteger(value: number): string {
  return value.toString();
}
/**
 * @internal
 * @param value Value to deserialise.
 * @returns Deserialized integer, or null if the given value is not a valid serialised integer.
 */
export function deserializeInteger(literalString: string): number | null {
  const deserialized = Number.parseInt(literalString, 10);
  if (Number.isNaN(deserialized)) {
    return null;
  }
  return deserialized;
}

/**
 * @internal
 * @param locale Locale to transform into a consistent format.
 */
export function normalizeLocale(locale: string): string {
  return locale.toLowerCase();
}

/**
 * @internal Library users shouldn't need to be exposed to raw NamedNodes.
 * @param value The value that might or might not be a Named Node.
 * @returns Whether `value` is a Named Node.
 */
export function isNamedNode<T>(value: T | NamedNode): value is NamedNode {
  return isTerm(value) && value.termType === "NamedNode";
}

/**
 * @internal Library users shouldn't need to be exposed to raw Literals.
 * @param value The value that might or might not be a Literal.
 * @returns Whether `value` is a Literal.
 */
export function isLiteral<T>(value: T | Literal): value is Literal {
  return isTerm(value) && value.termType === "Literal";
}

/**
 * @internal Library users shouldn't need to be exposed to raw Terms.
 * @param value The value that might or might not be a Term.
 * @returns Whether `value` is a Term.
 */
export function isTerm<T>(value: T | Term): value is Term {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as Term).termType === "string" &&
    typeof (value as Term).value === "string" &&
    typeof (value as Term).equals === "function"
  );
}

/**
 * @internal Library users shouldn't need to be exposed to LocalNodes.
 * @param value The value that might or might not be a Node with no known IRI yet.
 * @returns Whether `value` is a Node with no known IRI yet.
 */
export function isLocalNode<T>(value: T | LocalNode): value is LocalNode {
  return (
    isTerm(value) &&
    value.termType === "BlankNode" &&
    typeof (value as LocalNode).internal_name === "string"
  );
}

/**
 * Construct a new LocalNode.
 *
 * @internal Library users shouldn't need to be exposed to LocalNodes.
 * @param name Name to identify this node by.
 * @returns A LocalNode whose name will be resolved when it is persisted to a Pod.
 */
export function getLocalNode(name: string): LocalNode {
  const localNode: LocalNode = Object.assign(DataFactory.blankNode(), {
    internal_name: name,
  });
  return localNode;
}

/**
 * Ensure that a given value is a Named Node.
 *
 * If the given parameter is a Named Node already, it will be returned as-is. If it is a string, it
 * will check whether it is a valid IRI. If not, it will throw an error; otherwise a Named Node
 * representing the given IRI will be returned.
 *
 * @internal Library users shouldn't need to be exposed to raw NamedNodes.
 * @param iri The IRI that should be converted into a Named Node, if it isn't one yet.
 */
export function asNamedNode(iri: Iri | IriString): NamedNode {
  if (isNamedNode(iri)) {
    return iri;
  }
  // If the runtime environment supports URL, instantiate one.
  // If the given IRI is not a valid URL, it will throw an error.
  // See: https://developer.mozilla.org/en-US/docs/Web/API/URL
  /* istanbul ignore else [URL is available in our testing environment, so we cannot test the alternative] */
  if (typeof URL !== "undefined") {
    new URL(iri);
  }
  return DataFactory.namedNode(iri);
}

interface IsEqualOptions {
  resourceIri?: IriString;
}
/**
 * Check whether two current- or potential NamedNodes are/will be equal.
 *
 * @internal Utility method; library users should not need to interact with LocalNodes directly.
 */
export function isEqual(
  node1: NamedNode | LocalNode,
  node2: NamedNode | LocalNode,
  options: IsEqualOptions = {}
): boolean {
  if (isNamedNode(node1) && isNamedNode(node2)) {
    return node1.equals(node2);
  }
  if (isLocalNode(node1) && isLocalNode(node2)) {
    return node1.internal_name === node2.internal_name;
  }
  if (typeof options.resourceIri === "undefined") {
    // If we don't know what IRI to resolve the LocalNode to,
    // we cannot conclude that it is equal to the NamedNode's full IRI:
    return false;
  }
  const namedNode1 = isNamedNode(node1)
    ? node1
    : resolveIriForLocalNode(node1, options.resourceIri);
  const namedNode2 = isNamedNode(node2)
    ? node2
    : resolveIriForLocalNode(node2, options.resourceIri);
  return namedNode1.equals(namedNode2);
}

/**
 * @internal Utility method; library users should not need to interact with LocalNodes directly.
 * @param quad The Quad to resolve LocalNodes in.
 * @param resourceIri The IRI of the Resource to resolve the LocalNodes against.
 */
export function resolveIriForLocalNodes(
  quad: Quad,
  resourceIri: IriString
): Quad {
  const subject = isLocalNode(quad.subject)
    ? resolveIriForLocalNode(quad.subject, resourceIri)
    : quad.subject;
  const object = isLocalNode(quad.object)
    ? resolveIriForLocalNode(quad.object, resourceIri)
    : quad.object;
  return {
    ...quad,
    subject: subject,
    object: object,
  };
}

/**
 * @internal Utility method; library users should not need to interact with LocalNodes directly.
 * @param localNode The LocalNode to resolve to a NamedNode.
 * @param resourceIri The Resource in which the Node will be saved.
 */
export function resolveIriForLocalNode(
  localNode: LocalNode,
  resourceIri: IriString
): NamedNode {
  return DataFactory.namedNode(
    resolveLocalIri(localNode.internal_name, resourceIri)
  );
}

/**
 * @internal API for internal use only.
 * @param name The name identifying a Thing.
 * @param resourceIri The Resource in which the Thing can be found.
 */
export function resolveLocalIri(
  name: string,
  resourceIri: IriString
): IriString {
  /* istanbul ignore if [The URL interface is available in the testing environment, so we cannot test this] */
  if (typeof URL === "undefined") {
    throw new Error(
      "The URL interface is not available, so an IRI cannot be determined."
    );
  }
  const thingIri = new URL(resourceIri);
  thingIri.hash = name;
  return thingIri.href;
}
