################################################################################
CHANGE NOTICE for https://ftp.ncbi.nlm.nih.gov/genomes/all
                  https://ftp.ncbi.nlm.nih.gov/genomes/ASSEMBLY_REPORTS/All

Last updated:  September 22, 2016
################################################################################

Genomes FTP site data organization to change on September 20, 2016
==================================================================

NCBI is moving the contents of the "all" and "ASSEMBY_REPORTS/All directories on
the Genomes FTP site (https://ftp.ncbi.nlm.nih.gov/genomes/). Currently, listing 
the contents of these two directories is impractical because they contain many 
thousands of directories or files.

Additional information about the genomes FTP site came be found in the genomes 
FTP README file (https://ftp.ncbi.nlm.nih.gov/genomes/all/README.txt) and in the 
genomes FTP FAQ (https://www.ncbi.nlm.nih.gov/genome/doc/ftpfaq/). Subscribe to 
the genomes-announce mail list to be informed of future changes to the NCBI 
genomes FTP site: https://www.ncbi.nlm.nih.gov/mailman/listinfo/genomes-announce


Reorganization of https://ftp.ncbi.nlm.nih.gov/genomes/all
========================================================

Changes:
--------
The genome assembly directories currently directly under "all" will be moved 
into a new 4 level structure under genomes/all. Two new directories under "all"
will be named for the accession prefix (GCA or GCF) and these directories will 
contain another three levels of directories named for digits 1-3, 4-6 & 7-9 of 
the assembly accession, creating paths like genomes/all/GCA/xxx/xxx/xxx/ & 
genomes/all/GCF/xxx/xxx/xxx/. For example: 
the data currently in genomes/all/GCA_000001405.23_GRCh38.p8 
     will be moved to genomes/all/GCA/000/001/405/GCA_000001405.23_GRCh38.p8
the data currently in genomes/all/GCF_001696305.1_UCN72.1 
     will be moved to genomes/all/GCF/001/696/305/GCF_001696305.1_UCN72.1


Schedule:
---------
On September 20, 2016 DONE
New directories genomes/all/GCA, genomes/all/GCF and the three levels of 
directories named for groups of digits in the assembly accession will be added.
Individual genome assembly data directories directly under genomes/all will be
moved into the new directory structure under genomes/all/GCA & GCF.
Assembly data directories directly under genomes/all will be replaced by 
symbolic links to the corresponding directory in the new structure.
The old and new data organizations will be maintained in parallel for 6 weeks.

On December 1, 2016
The old paths to individual genome assembly data directories directly under 
genomes/all will be removed.
All access to genome assembly data under genomes/all/ will need to use the 
genomes/all/GCA/xxx/xxx/xxx/ & genomes/all/GCF/xxx/xxx/xxx/ paths.


Impact:
-------
Users who access genome assembly data by any of the following methods will not 
be affected by this change:
- following a link to "Download the GenBank assembly" or "Download the RefSeq 
  assembly" from an Assembly details page
- navigating the genomes/genbank or genomes/refseq paths of the genomes FTP 
  site
- using the ftp_path provided in the assembly_summary.txt files provided on the
  genomes FTP site

Users who mirror all data under genomes/all will get two copies of the data for 
each genome assembly during the transition period unless they modify their 
scripts to only take data from genomes/all/GCA & GCF.

Scripts that retrieve data using hard-coded paths to individual genome assembly 
directories directly under genomes/all will fail after the transition period.

Links from non-NCBI web pages to individual genome assembly directories directly
under genomes/all will fail after the transition period.

Published paths to individual genome assembly directories directly under 
genomes/all will fail after the transition period.

Old paths in a file or web page can be converted into the new paths using the 
following Perl command:
perl -pe 's|all/(GC[AF])_(\d\d\d)(\d\d\d)(\d\d\d)\.|all/$1/$2/$3/$4/$1_$2$3$4.|g' ftp.paths.old > ftp.paths.new


Removal of https://ftp.ncbi.nlm.nih.gov/genomes/ASSEMBY_REPORTS/All
=================================================================

Changes:
--------
First, the assembly reports currently under genomes/ASSEMBLY_REPORTS/All will be
moved into the assembly data directories in the new directory hierarchy under 
genomes/all/GCA & genomes/all/GCF described above, replacing the symbolic links 
to the assembly report files that currently exist in the assembly data 
directories. The assembly report files in the assembly data directories will 
retain the name previously provided by the symbolic link:
{assembly_accession.version}.assembly.txt will appear as 
{assembly_accession.version}_{assembly_name}_assembly_report.txt
{assembly_accession.version}.stats.txt will appear as 
{assembly_accession.version}_{assembly_name}_assembly_stats.txt
{assembly_accession.version}.regions.txt will appear as 
{assembly_accession.version}_{assembly_name}_assembly_regions.txt

Then the genomes/ASSEMBLY_REPORTS/All directory will be removed.


Schedule:
---------
On September 20, 2016 DONE
The assembly reports currently under genomes/ASSEMBLY_REPORTS/All will be moved 
into the assembly data directories, replacing the symbolic links currently in 
the data directories.
The assembly reports under genomes/ASSEMBLY_REPORTS/All will be replaced by 
symbolic links to the corresponding report in the assembly data directory.
The old and new data organizations for assembly reports will be maintained in 
parallel for 6 weeks.

On December 1, 2016
The old paths to assembly reports under genomes/ASSEMBLY_REPORTS/All will be 
removed.
The genomes/ASSEMBLY_REPORTS/All directory will be removed.
All access to assembly reports will need to use the genomes/all/GCA/, 
genomes/all/GCF, genomes/genbank or genomes/refseq paths to the individual 
assembly data directories.


Impact:
-------
Users who access assembly reports by any of the following methods will not be 
affected by this change:
- following a link to "Download the full sequence report" from an Assembly 
  details page
- from an assembly data directory under the genomes/genbank or genomes/refseq 
  path on the genomes FTP site

Attepts to access assembly reports using the genomes/ASSEMBLY_REPORTS/All path 
will fail after the transition period.

________________________________________________________________________________
National Center for Biotechnology Information (NCBI)
National Library of Medicine
National Institutes of Health
8600 Rockville Pike
Bethesda, MD 20894, USA
tel: (301) 496-2475
fax: (301) 480-9241
e-mail: info@ncbi.nlm.nih.gov
________________________________________________________________________________
