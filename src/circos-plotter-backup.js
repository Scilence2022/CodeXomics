{
  "description": "Sample Circos data for E. coli K-12 genome",
  "chromosomes": [
    {
      "name": "E.coli",
      "length": 4641652,
      "color": "#1f77b4"
    }
  ],
  "genes": [
    {
      "chromosome": "E.coli",
      "start": 190,
      "end": 255,
      "name": "thrL",
      "type": "protein_coding",
      "value": 0.8,
      "description": "thr operon leader peptide"
    },
    {
      "chromosome": "E.coli",
      "start": 337,
      "end": 2799,
      "name": "thrA",
      "type": "protein_coding",
      "value": 0.9,
      "description": "aspartate kinase/homoserine dehydrogenase"
    },
    {
      "chromosome": "E.coli",
      "start": 2801,
      "end": 3733,
      "name": "thrB",
      "type": "protein_coding",
      "value": 0.85,
      "description": "homoserine kinase"
    },
    {
      "chromosome": "E.coli",
      "start": 3734,
      "end": 5020,
      "name": "thrC",
      "type": "protein_coding",
      "value": 0.75,
      "description": "threonine synthase"
    },
    {
      "chromosome": "E.coli",
      "start": 5234,
      "end": 5530,
      "name": "yaaX",
      "type": "protein_coding",
      "value": 0.6,
      "description": "DUF2569 family protein"
    },
    {
      "chromosome": "E.coli",
      "start": 5683,
      "end": 6459,
      "name": "yaaA",
      "type": "protein_coding",
      "value": 0.7,
      "description": "peroxide resistance protein"
    },
    {
      "chromosome": "E.coli",
      "start": 6529,
      "end": 7959,
      "name": "yaaJ",
      "type": "protein_coding",
      "value": 0.65,
      "description": "transporter"
    },
    {
      "chromosome": "E.coli",
      "start": 8238,
      "end": 9191,
      "name": "talB",
      "type": "protein_coding",
      "value": 0.9,
      "description": "transaldolase B"
    },
    {
      "chromosome": "E.coli",
      "start": 9306,
      "end": 9893,
      "name": "mog",
      "type": "protein_coding",
      "value": 0.8,
      "description": "molybdopterin adenylyltransferase"
    },
    {
      "chromosome": "E.coli",
      "start": 9928,
      "end": 10494,
      "name": "satP",
      "type": "protein_coding",
      "value": 0.55,
      "description": "acetate/succinate:H+ symporter"
    },
    {
      "chromosome": "E.coli",
      "start": 10643,
      "end": 11356,
      "name": "yaaH",
      "type": "protein_coding",
      "value": 0.4,
      "description": "DUF2756 family protein"
    },
    {
      "chromosome": "E.coli",
      "start": 11382,
      "end": 11786,
      "name": "yaaW",
      "type": "protein_coding",
      "value": 0.5,
      "description": "UPF0174 family protein"
    },
    {
      "chromosome": "E.coli",
      "start": 11899,
      "end": 13227,
      "name": "yaaI",
      "type": "protein_coding",
      "value": 0.7,
      "description": "DUF2771 family protein"
    },
    {
      "chromosome": "E.coli",
      "start": 13300,
      "end": 14172,
      "name": "dnaK",
      "type": "protein_coding",
      "value": 0.95,
      "description": "molecular chaperone DnaK"
    },
    {
      "chromosome": "E.coli",
      "start": 14300,
      "end": 15430,
      "name": "dnaJ",
      "type": "protein_coding",
      "value": 0.9,
      "description": "molecular chaperone DnaJ"
    }
  ],
  "tracks": [
    {
      "name": "GC Content",
      "type": "histogram",
      "data": [
        {
          "chromosome": "E.coli",
          "start": 0,
          "end": 500000,
          "value": 0.51
        },
        {
          "chromosome": "E.coli",
          "start": 500000,
          "end": 1000000,
          "value": 0.48
        },
        {
          "chromosome": "E.coli",
          "start": 1000000,
          "end": 1500000,
          "value": 0.52
        },
        {
          "chromosome": "E.coli",
          "start": 1500000,
          "end": 2000000,
          "value": 0.49
        },
        {
          "chromosome": "E.coli",
          "start": 2000000,
          "end": 2500000,
          "value": 0.53
        },
        {
          "chromosome": "E.coli",
          "start": 2500000,
          "end": 3000000,
          "value": 0.47
        },
        {
          "chromosome": "E.coli",
          "start": 3000000,
          "end": 3500000,
          "value": 0.50
        },
        {
          "chromosome": "E.coli",
          "start": 3500000,
          "end": 4000000,
          "value": 0.52
        },
        {
          "chromosome": "E.coli",
          "start": 4000000,
          "end": 4641652,
          "value": 0.48
        }
      ]
    }
  ],
  "links": [
    {
      "source": {
        "chromosome": "E.coli",
        "start": 100000,
        "end": 150000
      },
      "target": {
        "chromosome": "E.coli",
        "start": 2000000,
        "end": 2050000
      },
      "value": 0.8,
      "type": "synteny"
    },
    {
      "source": {
        "chromosome": "E.coli",
        "start": 500000,
        "end": 550000
      },
      "target": {
        "chromosome": "E.coli",
        "start": 3000000,
        "end": 3050000
      },
      "value": 0.6,
      "type": "duplication"
    },
    {
      "source": {
        "chromosome": "E.coli",
        "start": 1000000,
        "end": 1100000
      },
      "target": {
        "chromosome": "E.coli",
        "start": 4000000,
        "end": 4100000
      },
      "value": 0.9,
      "type": "inversion"
    }
  ],
  "parameters": {
    "title": "E. coli K-12 Genome Circos Plot",
    "organism": "Escherichia coli K-12 MG1655",
    "version": "RefSeq NC_000913.3",
    "created": "2024-12-06"
  }
} 