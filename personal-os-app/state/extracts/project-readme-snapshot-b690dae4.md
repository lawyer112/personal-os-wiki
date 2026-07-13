# Project README Snapshot

source_id: file:project-readme
source_type: file

Revision 2 adds the manifest delta tracking rule:
- same hash means skip;
- same source_id with changed hash means update;
- unknown source_id and unknown hash means ingest.