# Restriction enzyme catalog sources

The offline catalog uses the [Biopython 1.87 restriction dictionary](https://github.com/biopython/biopython/blob/biopython-187/Bio/Restriction/Restriction_Dictionary.py), generated from REBASE EMBOSS 404 (2024). The Biopython dictionary carries the copyright notice of Frederic Sohm (2004) and is distributed under the accompanying [Biopython license](Biopython-LICENSE.txt). See [the REBASE reference](https://doi.org/10.1093/nar/gkac975) for the scope of the upstream database.

The importer selects DNA entries with a single IUPAC motif and one defined double-strand cut pair. It converts the bottom cut to the same coordinate origin as the top cut, preserving numeric positions before and after the motif. Entries with undefined cut positions or two cut pairs are outside this import. Supplier names describe listings in the snapshot. An empty supplier list means the source contains no listing for that entry.

Regenerate the vendored file by running `python3 scripts/generate-restriction-enzyme-catalog.py /path/to/Restriction_Dictionary.py` with the pinned dictionary. The importer checks the input hash before reading records.

CodeXomics also includes selected product variants and nicking enzymes checked against the [NEB recognition sequence reference](https://www.neb.com/en/tools-and-resources/selection-charts/alphabetized-list-of-recognition-specificities) and [nicking enzyme catalog](https://www.neb.com/en/products/restriction-endonucleases/hf-nicking-master-mix-time-saver-other/nicking-endonucleases). The [NEB Type IIS chart](https://www.neb.com/tools-and-resources/selection-charts/type-iis-restriction-enzymes) supports the verified Type IIS subset. The outside-site set uses the stored geometry regardless of subtype. Nicking entries display one cut in the catalog and cannot be used to generate double-strand fragments.

The Tsp509I lookup resolves to TasI, following the [Thermo Fisher product designation](https://www.thermofisher.com/order/catalog/product/ER1352).

The nonredundant commercial set groups records by recognition motif and cleavage offsets, allowing for reverse-complement representations. Distinct cleavage geometries at the same recognition site remain independently selectable.
