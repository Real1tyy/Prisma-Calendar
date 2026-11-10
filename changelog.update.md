### Fixed

- **ZettelID property is written as a number**: events created, cloned, imported, synced or auto-named now store `ZettelID: 20261023174414` rather than the quoted `"20261023174414"`, so tools that read the property as a number see the value they expect. Existing notes keep whatever value they already have.
