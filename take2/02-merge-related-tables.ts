import { table } from "console";
import _ from "lodash";

interface Occurrence {
  tableName: string;
  rowIndex: number;
  columnName: string;
  value: string | number | boolean;
  valueType: "string" | "number" | "boolean";
}

interface Correspondence {
  table1: string;
  column1: string[];
  table2: string;
  column2: string[];
}

interface EfficiencyResult {
  efficiency: number;
  evidence: number;
}

interface CorrespondenceWithEfficiency {
  correspondenceType:
    | "one-to-one"
    | "left-parent-of-right"
    | "left-child-of-right";
  correspondence: Correspondence;
  efficiency: number;
  evidence: number;
}

interface Table {
  [columnName: string]: string | number | boolean;
  $meta?: any;
}

interface DiscoveredMapping {
  type: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many" | "child" /*specialization of one-to-many*/| "parent" /*specialization of many-to-one */;
  primaryKeys: 0 | 1 | 2;
  target: string;
  joinOn: { source: string; target: string }[];
}

interface Schema {
  name: string;
  primaryKey: { columnName: string }[];
  columns: {
    name: string;
    type: string;
    mergedFrom?: string;
  }[];
  pkOnly?: boolean;
  discoveredMappings?: DiscoveredMapping[];
}

interface TablesMap {
  [tableName: string]: Table[];
}

interface SchemasMap {
  [tableName: string]: Schema;
}

// Function to find occurrences of entities across tables
const INVALID_PREFIXES = ["/", "$"];
function findEntityOccurrences(tables: TablesMap): Occurrence[] {
  const entitySuffixes = [
    "REAL",
    "DATE",
    "CODE",
    "ID",
    "CSN",
    "LINE",
    "NUM",
    "PTR",
  ];
  return _.flatMap(tables, (table, tableName) =>
    _.flatMap(table, (row, rowIndex) =>
      _.map(row, (value, columnName) => ({
        tableName,
        rowIndex,
        columnName,
        value,
        valueType: typeof value as "string" | "number" | "boolean",
      }))
        .filter(
          (r): r is Occurrence =>
            (r.valueType === "string" ||
              r.valueType === "number" ||
              r.valueType === "boolean") &&
            !INVALID_PREFIXES.some((p) => r.columnName.startsWith(p))
        )
        .filter((r) =>
          entitySuffixes.some((suffix) => r.columnName.endsWith(suffix))
        )
    )
  );
}

// Function to generate candidate single-column correspondences
function generateCandidateCorrespondences(
  occurrences: Occurrence[]
): Correspondence[] {
  const groupedOccurrences = _.groupBy(occurrences, "value");
  const candidateCorrespondences = _.flatMap(groupedOccurrences, (group) =>
    _.flatMap(group, (occurrence1) =>
      _.filter(
        group,
        (occurrence2) => occurrence1.tableName < occurrence2.tableName
      ).map((occurrence2) => ({
        table1: occurrence1.tableName,
        column1: [occurrence1.columnName],
        table2: occurrence2.tableName,
        column2: [occurrence2.columnName],
      }))
    )
  );

  return _.uniqBy(
    _.sortBy(candidateCorrespondences, [
      (correspondence) => correspondence.table1,
      (correspondence) => correspondence.table2,
      (correspondence) => correspondence.column1[0],
      (correspondence) => correspondence.column2[0],
    ]),
    (k) => JSON.stringify(k)
  );
}

const MIN_TABLE_SIZE = 1;

function calculateEfficiency(
  tables: TablesMap,
  correspondence: Correspondence,
  relationshipType: string
): EfficiencyResult {
  const { table1, column1, table2, column2 } = correspondence;
  const values1 = _.map(tables[table1], (row) =>
    _.join(
      _.map(column1, (col) => row[col]),
      "_"
    )
  );
  const values2 = _.map(tables[table2], (row) =>
    _.join(
      _.map(column2, (col) => row[col]),
      "_"
    )
  );

  if (Math.min(values1.length, values2.length) < MIN_TABLE_SIZE) {
    return { efficiency: 0, evidence: 0 };
  }

  let evidence = 0;

  if (relationshipType === "one-to-one") {
    const uniqueValues = _.uniq(_.concat(values1, values2));
    evidence = uniqueValues.length;
    const efficiency = _.reduce(
      uniqueValues,
      (product, value) =>
        product *
        _.filter(values1, (v) => v === value).length *
        _.filter(values2, (v) => v === value).length,
      1
    );
    return { efficiency, evidence };
  } else if (relationshipType === "left-parent-of-right") {
    const uniqueValuesRight = _.uniq(values2);
    evidence = uniqueValuesRight.length;
    const efficiency = _.reduce(
      uniqueValuesRight,
      (product, value) =>
        product * _.filter(values1, (v) => v === value).length,
      1
    );
    return { efficiency, evidence };
  } else if (relationshipType === "left-child-of-right") {
    const uniqueValuesLeft = _.uniq(values1);
    evidence = uniqueValuesLeft.length;
    const efficiency = _.reduce(
      uniqueValuesLeft,
      (product, value) =>
        product * _.filter(values2, (v) => v === value).length,
      1
    );
    return { efficiency, evidence };
  }

  throw new Error("Invalid relationship type");
}

// Function to generate candidate (n+1)-column correspondences
function generateNextColumnCorrespondences(
  candidateCorrespondences: Correspondence[],
  bestCorrespondence: CorrespondenceWithEfficiency
): Correspondence[] {
  return _.flatMap(candidateCorrespondences, (correspondence) => {
    if (
      correspondence.table1 === bestCorrespondence.correspondence.table1 &&
      correspondence.table2 === bestCorrespondence.correspondence.table2 &&
      !_.includes(
        bestCorrespondence.correspondence.column1,
        correspondence.column1[0]
      ) &&
      !_.includes(
        bestCorrespondence.correspondence.column2,
        correspondence.column2[0]
      )
    ) {
      return {
        table1: bestCorrespondence.correspondence.table1,
        column1: [
          ...bestCorrespondence.correspondence.column1,
          correspondence.column1[0],
        ],
        table2: bestCorrespondence.correspondence.table2,
        column2: [
          ...bestCorrespondence.correspondence.column2,
          correspondence.column2[0],
        ],
      };
    }
    return null;
  }).filter(
    (correspondence): correspondence is Correspondence =>
      correspondence !== null
  );
}

function findBestColumnSet(
  tables: TablesMap,
  candidateCorrespondences: Correspondence[],
  currentBestCorrespondence: CorrespondenceWithEfficiency,
  relationshipType: string
): CorrespondenceWithEfficiency {
  if (_.isEmpty(candidateCorrespondences)) {
    return currentBestCorrespondence;
  }

  const nextColumnCorrespondences = generateNextColumnCorrespondences(
    candidateCorrespondences,
    currentBestCorrespondence
  );

  if (_.isEmpty(nextColumnCorrespondences)) {
    return currentBestCorrespondence;
  }

  const efficiencies: CorrespondenceWithEfficiency[] = _.map(
    nextColumnCorrespondences,
    (correspondence) => {
      const { efficiency, evidence } = calculateEfficiency(
        tables,
        correspondence,
        relationshipType
      );
      return {
        correspondenceType:
          relationshipType as CorrespondenceWithEfficiency["correspondenceType"],
        correspondence,
        efficiency,
        evidence,
      };
    }
  );

  const bestCorrespondence = findClosestToOne(efficiencies);

  if (
    !bestCorrespondence ||
    currentBestCorrespondence.efficiency <= bestCorrespondence.efficiency
  ) {
    return currentBestCorrespondence;
  }

  // Check if the best correspondence only contains the "LINE" column and has low evidence
  const lineThreshold = 10;
  if (
    (bestCorrespondence.correspondence.column1.at(-1)?.match("LINE") ||
      bestCorrespondence.correspondence.column2.at(-1)?.match("LINE")) &&
    bestCorrespondence.evidence <
      currentBestCorrespondence.evidence * lineThreshold
  ) {
    return currentBestCorrespondence;
  }

  return findBestColumnSet(
    tables,
    candidateCorrespondences,
    bestCorrespondence,
    relationshipType
  );
}

function findClosestToOne(correspondences: CorrespondenceWithEfficiency[]) {
  return _.minBy(
    _.filter(correspondences, (result) => result.efficiency >= 1),
    (result) => Math.abs(1 - result.efficiency)
  );
}

function findClosestToOneWithTies(correspondences: CorrespondenceWithEfficiency[]) {
  // Filter correspondences with efficiency >= 1
  const filtered = _.filter(correspondences, (result) => result.efficiency >= 1);

  // Find the minimum difference from 1
  const minDiff = _.minBy(filtered, (result) => Math.abs(1 - result.efficiency))!;

  // Return all correspondences with the minimum difference
  return _.filter(filtered, (result) => result.efficiency === minDiff.efficiency);
}

function identifyEfficientColumnCorrespondence(
  tables: TablesMap,
  schemas: SchemasMap,
  relationshipTypes: string[] = [
    "one-to-one",
    "left-parent-of-right",
    "left-child-of-right",
  ]
): DiscoveredMapping | null {
  // ... (modify the function to return DiscoveredMapping instead of performing merges)
  const occurrences = findEntityOccurrences(tables);
  const candidateCorrespondences =
    generateCandidateCorrespondences(occurrences);
  if (candidateCorrespondences.length === 0) {
    return null;
  }

  const bestCorrespondences = _.flatMap(
    relationshipTypes,
    (relationshipType) => {
      const singleColumnEfficiencies = _.map(
        candidateCorrespondences.filter(
          (c) => !c.column1[0].match("LINE") && !c.column2[0].match("LINE")
        ),
        (correspondence) => ({
          correspondence,
          correspondenceType:
            relationshipType as CorrespondenceWithEfficiency["correspondenceType"],
          ...calculateEfficiency(tables, correspondence, relationshipType),
        })
      );
      const bestSingleColumnCorrespondence = findClosestToOneWithTies(
        singleColumnEfficiencies
      );
      return bestSingleColumnCorrespondence.flatMap((bestSingleColumnCorrespondence) => {
      if (!bestSingleColumnCorrespondence) {
        return [];
      }
      const bestFullCorrespondence = findBestColumnSet(
        tables,
        candidateCorrespondences,
        bestSingleColumnCorrespondence,
        relationshipType
      );

      if (bestFullCorrespondence.efficiency !== 1) {
        return [];
      }

      return [
        {
          relationshipType,
          ...bestFullCorrespondence,
        },
      ];
      })
    }
  );

  const best = findClosestToOneWithTies(bestCorrespondences);
  if (!best) {
    return null;
  }

    const bestDiscoveries: DiscoveredMapping[] = best.flatMap((best) => {

      const { table1, table2, column1, column2 } = best.correspondence;
      const joinOn = column1.map((source, index) => ({
        source,
        target: column2[index],
      }));

      function usesAll(primaryKeyNames: string[], usedKeyNames: string[]) {
        return primaryKeyNames.every(pk => usedKeyNames.includes(pk)) ? 1  : 0;
      }

      function usesSome(primaryKeyNames: string[], usedKeyNames: string[]) {
        return _.takeWhile(primaryKeyNames, pk => usedKeyNames.includes(pk)).length > 0
      }


      const leftUsesAllPrimaryKeys: 0 | 1 = usesAll(schemas[table1].primaryKey.map(pk => pk.columnName), joinOn.map(j => j.source));
      const rightUsesAllPrimaryKeys: 0 | 1 = usesAll(schemas[table2].primaryKey.map(pk => pk.columnName), joinOn.map(j => j.target));
      const leftUsesSomePrimaryKeys: 0 | 1 = usesSome(schemas[table1].primaryKey.map(pk => pk.columnName), joinOn.map(j => j.source)) ? 1 : 0;
      const rightUsesSomePrimaryKeys: 0 | 1 = usesSome(schemas[table2].primaryKey.map(pk => pk.columnName), joinOn.map(j => j.target)) ? 1 : 0;

      const allPrimaryKeys = (
        best.correspondenceType === "left-child-of-right" ?
          leftUsesSomePrimaryKeys + rightUsesAllPrimaryKeys :
        "left-parent-of-right" ?
          leftUsesAllPrimaryKeys + rightUsesSomePrimaryKeys :
          leftUsesAllPrimaryKeys + rightUsesAllPrimaryKeys);



      return {
        type:
          best.efficiency > 1 ? "many-to-many" : 
          best.correspondenceType === "left-parent-of-right" ? "one-to-many" :
          best.correspondenceType === "left-child-of-right" ? "many-to-one" :
          allPrimaryKeys ? "one-to-one" : "one-to-many",
        primaryKeys: allPrimaryKeys as 0 | 1 | 2,
        target: table2,
        joinOn,
      };
  });
  const typeScores = {
    "one-to-one": 3,
    "one-to-many": 2,
    "many-to-one": 2,
    "many-to-many": 1,
    // TODO one-to-optional, optional-to-one
  };
  const ret =  _.maxBy(bestDiscoveries, (d) => [d.primaryKeys, typeScores[d.type]]) as DiscoveredMapping;
    if (tables["PAT_ENC"] && tables["SOCIAL_HX"]) {
    console.log("social and enc Best correspondence", relationshipTypes,  bestDiscoveries, ret);
  }

  return ret;
}

function mergeTables(
  baseTable: Table[],
  baseSchema: Schema,
  mergingTable: Table[],
  mergingSchema: Schema,
  baseJoinKeys: string[],
  mergingJoinKeys: string[]
): { mergedTable: Table[]; mergedSchema: Schema } {
  const mergedTable = JSON.parse(JSON.stringify(baseTable)) as Table[];
  const mergedSchema = JSON.parse(JSON.stringify(baseSchema));
  let logged = false;
  for (const mergingRow of mergingTable) {
    const baseRowIndex = mergedTable.findIndex((baseRow) =>
      baseJoinKeys.every((baseKey, index) => {
        const mergingKey = mergingJoinKeys[index];
        return "" + baseRow[baseKey] === "" + mergingRow[mergingKey];
      })
    );

    if (baseRowIndex !== -1) {
      const baseRow = mergedTable[baseRowIndex];
      if (!logged) {
        console.log(
          "COls to merge: ",
          baseSchema.name,
          Object.keys(baseRow).length,
          mergingSchema.name,
          Object.keys(mergingRow).length
        );
      }
      logged = true;

      // check for any samme-named but conflicting-value columns
      let columnConflicts = false;
      for (const [columnName, columnValue] of Object.entries(mergingRow).filter(
        ([k]) => k !== "$meta"
      )) {
        if (columnName in baseRow && baseRow[columnName] !== columnValue) {
          columnConflicts = true;
          console.log(
            "Conflicting values for column",
            columnName,
            "in row",
            mergingRow[columnName],
            "with base row",
            baseRow[columnName]
          );
        }
      }
      if (columnConflicts) {
        throw "Conflicting values in merging row";
      }
      baseRow[
        "// begin merge: " +
          mergingSchema.name +
          " on (" +
          mergingJoinKeys
            .map((k, i) => `${k}=base.${baseJoinKeys[i]}`)
            .join(", ") +
          ")"
      ] = true;
      for (const [columnName, columnValue] of Object.entries(mergingRow).filter(
        ([k]) => k !== "$meta"
      )) {
        if (!(columnName in baseRow)) {
          baseRow[columnName] = columnValue;
        }
      }
      baseRow.$meta = baseRow.$meta || {};
      baseRow.$meta.merged = baseRow.$meta.merged || [];
      baseRow.$meta.mergeCount = (baseRow.$meta.mergeCount || 0) + 1;
      baseRow.$meta.merged = Array.from(
        new Set(
          baseRow.$meta.merged.concat(
            mergingRow.$meta.merged || [mergingRow.$meta.type]
          )
        )
      );
      if (baseRow.$meta.mergeCount > 100) {
        console.error("High hmerge count on row", baseSchema.name);
      }
    } else {
      console.log(mergingRow);
      console.log(mergingJoinKeys);
      console.log(baseTable);
      console.log(baseJoinKeys);
      throw (
        "Row not found in base table for merging row: " +
        JSON.stringify(mergingRow) +
        " with join keys: " +
        JSON.stringify(mergingJoinKeys) +
        "against  base join keys " +
        JSON.stringify(baseJoinKeys)
      );
    }
  }

  for (const discoveredMapping of mergingSchema.discoveredMappings || []) {
    mergedSchema.discoveredMappings.push(discoveredMapping);
  }
  for (const column of mergingSchema.columns) {
    if (
      !mergingJoinKeys.includes(column.name) &&
      !mergedSchema.columns.some((c) => c.name === column.name)
    ) {
      mergedSchema.columns.push({ ...column, mergedFrom: mergingSchema.name });
    }
  }

  return { mergedTable, mergedSchema };
}


function decorateSchemaWithHeuristicMappings(
  tables: TablesMap,
  schemas: SchemasMap
): SchemasMap {
  const decoratedSchemas: SchemasMap = { ...schemas };

  for (const table1 of Object.keys(tables)) {
    for (const table2 of Object.keys(tables)) {
      if (table1 >= table2) {
        continue;
      }

      const efficientColumnCorrespondence =
        identifyEfficientColumnCorrespondence(
          {
            [table1]: tables[table1],
            [table2]: tables[table2],
          },
          {
            [table1]: schemas[table1],
            [table2]: schemas[table2],
          }
        );

      if (efficientColumnCorrespondence) {
        const { type, target, joinOn, primaryKeys } = efficientColumnCorrespondence;
        decoratedSchemas[table1].discoveredMappings = [
          ...(decoratedSchemas[table1].discoveredMappings || []),
          { type, target: table2, joinOn, primaryKeys},
        ];
        decoratedSchemas[table2].discoveredMappings = [
          ...(decoratedSchemas[table2].discoveredMappings || []),
          {
            type:
              type === "one-to-many"
                ? "many-to-one"
                : type === "many-to-one"
                ? "one-to-many"
                : "one-to-one",
            primaryKeys,
            target: table1,
            joinOn: joinOn.map(({ source, target }) => ({
              source: target,
              target: source,
            })),
          },
        ];

      }
    }
  }

  return decoratedSchemas;
}

const IMPORTANT_PREFIXES = ["PATIENT", "PAT_ENC", "COVERAGE"];
function mergeTablesWithDiscoveredMappings(
  tables: TablesMap,
  schemas: SchemasMap
): { mergedTables: TablesMap; mergedSchemas: SchemasMap } {
  let mergedTables = { ...tables };
  let mergedSchemas = { ...schemas };

  let mergePerformed = true;
  while (mergePerformed) {
    mergePerformed = false;

    // Sort the schemas by table name length (shortest first)
    const sortedSchemas = Object.values(mergedSchemas).sort((a, b) => {
      const aLength = a.name.split("_").length;
      const bLength = b.name.split("_").length;
      if (IMPORTANT_PREFIXES.includes(a.name)) {
        return -1;
      } else if (IMPORTANT_PREFIXES.includes(b.name)) {
        return 1;
      }
      if (aLength === bLength) {
        return -1;
      }
      return aLength - bLength;
    });

    for (const schema of sortedSchemas) {
      const oneToOneMappings = _.sortBy(
        (schema.discoveredMappings || []).filter(
          (mapping) => mapping.type === "one-to-one" && mapping.primaryKeys == 2
        ),
        (m) => m.target
      );

      if (oneToOneMappings.length > 0) {
        const greatestTable = schema.name;
        const greatestTableMappings = oneToOneMappings.map(
          (mapping) => mapping.target
        );

        console.log("Merging", greatestTable, greatestTableMappings);

        for (const mapping of oneToOneMappings) {
          if (mergePerformed) {
            break;
          }
          const { target, joinOn } = mapping;
          if (target !== greatestTable) {
            console.log(
              "Check",
              greatestTable,
              "<--",
              target,
              "on",
              joinOn.map(({ source, target }) => `${source}=${target}`)
            );
            const lesserTableMappings = (
              mergedSchemas[target].discoveredMappings || []
            ).filter((mapping) => mapping.type === "one-to-one");

            console.log(
              "Proceeding with merge",
              greatestTable,
              "<--",
              target,
              oneToOneMappings,
              lesserTableMappings,
              joinOn
            );
            try {
              const { mergedTable, mergedSchema } = mergeTables(
                mergedTables[greatestTable],
                mergedSchemas[greatestTable],
                mergedTables[target],
                mergedSchemas[target],
                joinOn.map(({ source }) => source),
                joinOn.map(({ target }) => target)
              );
              mergedTables[greatestTable] = mergedTable;
              mergedSchemas[greatestTable] = mergedSchema;
              console.log("Delete schema for", target);
              console.log(
                "Merged",
                target,
                "into",
                greatestTable,
                "on",
                joinOn
              );
              // remove target from all dependency sets
              for (const depTable of Object.keys(mergedSchemas)) {
                mergedSchemas[depTable].discoveredMappings = (
                  mergedSchemas[depTable].discoveredMappings || []
                )
                  .map((m) => ({
                    ...m,
                    target: m.target === target ? greatestTable : m.target,
                  }))
                  .filter((m) => depTable !== m.target);
              }
              console.log("Clear deps for", target);
              delete mergedTables[target];
              delete mergedSchemas[target];

              // Remove any mapping from the decorations of both tables
              mergedSchemas[greatestTable].discoveredMappings = (
                mergedSchemas[greatestTable].discoveredMappings || []
              ).filter((m) => m.target !== target);

              mergePerformed = true;
            } catch (e) {
              console.error(
                "Failed to merge",
                greatestTable,
                "<--",
                target,
                "on",
                joinOn,
                e
              );

              mergedSchemas[greatestTable].discoveredMappings = (
                mergedSchemas[greatestTable].discoveredMappings || []
              ).filter((m) => m.target !== target);

              mergedSchemas[target].discoveredMappings = (
                mergedSchemas[target].discoveredMappings || []
              ).filter((m) => m.target !== greatestTable);

              continue;
            }
          }
        }

        if (mergePerformed) {
          break;
        }
      }
    }
  }

  return { mergedTables, mergedSchemas };
}

async function main({ inputFilename, outputFilename }) {
  const ehiFile = Bun.file(inputFilename);
  const ehiJson = await ehiFile.json();

  const tables: TablesMap = {};
  const schemas: SchemasMap = {};

  for (const [tableName, tableData] of Object.entries(ehiJson)) {
    if (tableName !== "$meta") {
      tables[tableName] = tableData as Table[];
      schemas[tableName] = ehiJson.$meta.schemas[tableName] as Schema;
    }
  }

  const nameBasedDecoratedSchemas = schemas; // decorateSchemaWithNameBasedMappings(schemas);
  const heuristicDecoratedSchemas = decorateSchemaWithHeuristicMappings(
    tables,
    nameBasedDecoratedSchemas
  );
  console.log("Decorated");

  // await Bun.write(
  //   outputFilename,
  //   JSON.stringify(
  //     { $meta: { schemas: heuristicDecoratedSchemas }, ...tables },
  //     null,
  //     2
  //   )
  // );

  const { mergedTables, mergedSchemas } = mergeTablesWithDiscoveredMappings(
    tables,
    heuristicDecoratedSchemas
  );

  console.log("FAM Mappings", JSON.stringify(mergedSchemas["FAMILY_HX"].discoveredMappings, null, 2));
  Object.values(mergedSchemas).forEach((schema) => {
    schema.discoveredMappings = schema.discoveredMappings || [];
    schema.discoveredMappings = _.sortBy(schema.discoveredMappings, (m) => m.primaryKeys * -1);
    schema.discoveredMappings = _.uniqBy(schema.discoveredMappings, (m: DiscoveredMapping) =>
      JSON.stringify({target: m.target, type: m.type})
    );
    schema.discoveredMappings = _.filter(schema.discoveredMappings, (m: DiscoveredMapping) => m.primaryKeys >= 1)
    schema.discoveredMappings = _.sortBy(schema.discoveredMappings, (m) => [
      m.target,
      m.type,
    ]);
    // look for one-to-many, primary keys < 2 -->  X, and if we find this, remove X from this level
    for (const cm of schema.discoveredMappings) {
      if (cm.primaryKeys < 2) {
        // Find a mapping that covers the current mapping
        const cmTargets = cm.joinOn.map(j => j.target);
        const covered = schema.discoveredMappings.filter(m => m.primaryKeys === 2).some(m => {
          const remoteSchema = mergedSchemas[m.target];
          return remoteSchema.discoveredMappings?.filter(m => m.primaryKeys === 2).some(covering => {
            
            const coveringTargets = covering.joinOn.map(j => j.target);
            const ret =  cm.target === covering.target && cmTargets.every(col => coveringTargets.includes(col))
            if (ret) {
              console.log("Covering", cm.target, "by", covering.target, "on", cm.joinOn.map(j => j.target), "by", covering.joinOn.map(j => j.target), "in", schema.name, "by", remoteSchema.name)
            }
            return ret;
          })
        })
        // If a covering mapping is found, remove the current mapping
        if (covered) {
          console.log("Removing", cm.target, "from", schema.name, "as it is covered by a primary key mapping")
          _.remove(schema.discoveredMappings, cm);
        }
      }
    }
    // look for one-to-many, primary keys = 2 -->  X, and if we find this, remove X from this level
    // for (const r of schema.discoveredMappings) {

    // }
  });

  await Bun.write(
    outputFilename,
    JSON.stringify(
      { $meta: { schemas: mergedSchemas }, ...mergedTables },
      null,
      2
    )
  );
}

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
const argv = yargs(hideBin(process.argv))
  .option("inputFilename", {
    description: "Path to the input JSON file",
    default: "ehi.json",
    type: "string",
  })
  .option("outputFilename", {
    description: "Output JSON file",
    default: "ehi-merged.json",
    type: "string",
  })
  .help()
  .alias("help", "h").argv;
console.log(argv);
main(argv);

// TODO populate discovered mappings into both sides of the rel.
// TODO de-duplicate the discovered mappings before output

/* If a table has a one-to-one mapping that uses *all of its columns*, the table can be deleted.
   (this is handled already if we go with the merging plan)

            "type": "one-to-one",
            "target": "HOMUNCULUS_PAT_DATA",
            "joinOn": [
              {
                "source": "PAT_ENC_CSN_ID",
                "target": "PAT_ENC_CSN_ID"
              },
              {
                "source": "CONTACT_DATE",
                "target": "CONTACT_DATE"
              },
              {
                "source": "PAT_ENC_DATE_REAL",
                "target": "PAT_ENC_DATE_REAL"
              }
            ]
 
*/
