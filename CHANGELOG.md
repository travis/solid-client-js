# Changelog

This project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

### New features

- `hasResourceInfo`: a function that can verify whether its parameter (e.g. a file or a
  SolidDataset) was fetched from somewhere, or was initialised in-memory.
- `createContainerAt` and `createContainerInContainer`: two functions that can help you create an
  empty Container at a given location or in another Container on the Pod, respectively.
- `isThing`: a function that can verify whether its parameter is a Thing.
- `mockSolidDatasetFrom`, `mockContainerFrom`, `mockFileFrom`, `mockThingFrom`,
  `addMockResourceAclTo` and `addMockFallbackAclTo`: functions that allow you to mock the
  solid-client data structures in your unit tests.
- `getFileWithAcl`: like `getSolidDatasetWithAcl`, this function lets you fetch a file along with
  its ACLs, if available.
- The legacy predicate `acl:defaultForNew` is now supported by our library. If you interact with a
  server where it is used to stipulate default access, `@inrupt/solid-client` will behave as expected.
- `getReadableThing()`: a function that takes a Thing and returns a string representation of it that
  can assist when debugging issues.

### Bugs fixed

- `getSourceUrl` used to throw an error when called on a Resource that was not fetched from
  somewhere (and hence had no source URL). It now returns `null` in that case.
- Giving more rights to an Agent or Group could lead to privilege escalation for an app identified
  by an `acl:origin` predicate in the ACL.
- While we allow reading data of different types, they are stored as plain strings. While multiple
  serialisations of data are often possible, we only supported one per data type. What this means
  is that, whereas we would correctly return `true` for a boolean stored as `"1"`, we would not do
  so for `"true"`, even though both are valid serialisations of the value `true` according to the
  XML Schema Datatypes specification: https://www.w3.org/TR/xmlschema-2. solid-client now recognises
  all valid serialisations of all supported data types as defined by that specification.

## [0.1.0] - 2020-08-06

### New features

First release! What's possible with this first release:

- Fetch data from Solid Pods or other public sources that publish Turtle data.
- Store data back to Solid Pods.
- Read data from datasets.
- Manipulate data in datasets.
- Inspect a user's, group's and public permissions w.r.t. a given Resource or child Resources of a
  Container. (Experimental.)
- Retrieve, delete and/or write any file (including non-RDF) from/to a Pod. (Experimental.)
