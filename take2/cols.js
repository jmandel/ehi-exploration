const _ = require("lodash");

// Function to find occurrences of entities across tables
function findEntityOccurrences(tables) {
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
        valueType: typeof value,
      }))
        .filter(
          (r) =>
            r.valueType === "string" ||
            r.valueType === "number" ||
            r.valueType === "boolean"
        )
        .filter((r) =>
          entitySuffixes.some((suffix) => r.columnName.endsWith(suffix))
        )
    )
  );
}

// Function to generate candidate single-column correspondences
function generateCandidateCorrespondences(occurrences) {
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
  // console.log("GO", candidateCorrespondences)

  return _.uniqBy(_.sortBy(candidateCorrespondences, [
    (correspondence) => correspondence.table1,
    (correspondence) => correspondence.table2,
    (correspondence) => correspondence.column1[0],
    (correspondence) => correspondence.column2[0],
  ]), k => JSON.stringify(k));
}

const MIN_TABLE_SIZE = 2

function calculateEfficiency(tables, correspondence, relationshipType) {
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

  if (relationshipType === "siblings") {
    const uniqueValues = _.uniq(_.concat(values1, values2));
    evidence = uniqueValues.length;
    const efficiency = _.reduce(
      uniqueValues,
      (product, value) =>
        product *
          _.filter(values1, (v) => v === value).length *  _.filter(values2, (v) => v === value).length,
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
}


// Function to generate candidate (n+1)-column correspondences
function generateNextColumnCorrespondences(
  candidateCorrespondences,
  bestCorrespondence
) {
  // console.log("Gen with best", bestCorrespondence, candidateCorrespondences)
  return _.flatMap(candidateCorrespondences, (correspondence) => {
    if (
      correspondence.table1 === bestCorrespondence.table1 &&
      correspondence.table2 === bestCorrespondence.table2 &&
      !_.includes(bestCorrespondence.column1, correspondence.column1[0]) &&
      !_.includes(bestCorrespondence.column2, correspondence.column2[0])
    ) {
      return {
        table1: bestCorrespondence.table1,
        column1: [...bestCorrespondence.column1, correspondence.column1[0]],
        table2: bestCorrespondence.table2,
        column2: [...bestCorrespondence.column2, correspondence.column2[0]],
      };
    }
    return null;
  }).filter((correspondence) => correspondence !== null);
}

function findBestColumnSet(
  tables,
  candidateCorrespondences,
  currentBestCorrespondence,
  relationshipType
) {
  if (_.isEmpty(candidateCorrespondences)) {
    return currentBestCorrespondence;
  }

  const nextColumnCorrespondences = generateNextColumnCorrespondences(
    candidateCorrespondences,
    currentBestCorrespondence.correspondence
  );

  if (_.isEmpty(nextColumnCorrespondences)) {
    return currentBestCorrespondence;
  }

  const efficiencies = _.map(nextColumnCorrespondences, (correspondence) => {
    const { efficiency, evidence } = calculateEfficiency(tables, correspondence, relationshipType);
    return {
      correspondence,
      efficiency,
      evidence,
    };
  });

  const bestCorrespondence = findClosestToOne(efficiencies);

  if (
    !bestCorrespondence ||
    currentBestCorrespondence.efficiency < bestCorrespondence.efficiency
  ) {
    return currentBestCorrespondence;
  }

  // Check if the best correspondence only contains the "LINE" column and has low evidence
  const lineThreshold = 10;
  if (
    (bestCorrespondence.correspondence.column1.at(-1).endsWith("LINE") ||
      bestCorrespondence.correspondence.column2.at(-1).endsWith("LINE"))
    &&
    bestCorrespondence.evidence < currentBestCorrespondence.evidence * lineThreshold
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

function findClosestToOne(correspondences) {
  // console.log("CORR", correspondences,  _.filter(correspondences, (result) => result.efficiency >= 1))
  return _.minBy(
    _.filter(correspondences, (result) => result.efficiency >= 1),
    (result) => Math.abs(1 - result.efficiency)
  );
}

// Main function to identify the most efficient column correspondence
function identifyEfficientColumnCorrespondence(tables, schema, relationshipTypes = ["siblings", "left-parent-of-right", "left-child-of-right"]) {
  const occurrences = findEntityOccurrences(tables);
  const candidateCorrespondences = generateCandidateCorrespondences(occurrences)
  if (candidateCorrespondences.length === 0) {
    return null;
  }

  const bestCorrespondences = _.flatMap(
    relationshipTypes,
    (relationshipType) => {
      const singleColumnEfficiencies = _.map(
        candidateCorrespondences.filter(c => c.column1[0]!=="LINE" && c.column2[0]!=="LINE"),
        (correspondence) => ({
          correspondence,
          ...calculateEfficiency(
            tables,
            correspondence,
            relationshipType
          ),
        })
      );
      const bestSingleColumnCorrespondence = findClosestToOne(
        singleColumnEfficiencies
      );
      if (!bestSingleColumnCorrespondence) {
        return [];
      }
      // console.log("BSS" , singleColumnEfficiencies,  bestSingleColumnCorrespondence)
      return [
        {
          relationshipType,
          ...findBestColumnSet(
            tables,
            candidateCorrespondences,
            bestSingleColumnCorrespondence,
            relationshipType
          ),
        },
      ];
    }
  );
  // if (bestCorrespondences[0]?.efficiency === 1 && bestCorrespondences[2]?.efficiency === 1) {
    // console.log("BEST", bestCorrespondences);
  // }
 
  const best = findClosestToOne(bestCorrespondences);
  if (!best){
    return null;
  }
  const { column1: column1Copy, column2: column2Copy } = best.correspondence;
  // console.log(best, column1Copy, column2Copy, best.correspondence.table1)
  const table1Columns = schema[best.correspondence.table1]?.columns;
  let newOrderIndices = best.correspondence.column1.map(col => table1Columns.findIndex(c => c.name === col));
  let column1WithIndices = column1Copy.map((value, i) => ({
    value,
    index: newOrderIndices[i],
  }));
  let column2WithIndices = column2Copy.map((value, i) => ({
    value,
    index: newOrderIndices[i],
  }));

  // Sort these arrays based on the index
  let sortedColumn1WithIndices = _.sortBy(column1WithIndices, "index");
  let sortedColumn2WithIndices = _.sortBy(column2WithIndices, "index");

  // Extract the sorted column1 and column2 from the sorted arrays
  best.correspondence.column1 = sortedColumn1WithIndices.map(
    (item) => item.value
  );
  best.correspondence.column2 = sortedColumn2WithIndices.map(
    (item) => item.value
  );

  return best
}

// Example usage
const tables = {
  table1: [
    { id: 1, name: "John", age: 25 },
    { id: 2, name: "Jane", age: 30 },
  ],
  table2: [
    { user_id: 1, first_name: "John", last_name: "Doe", age: 25 },
    { user_id: 2, first_name: "Jane", last_name: "Smith", age: 30 },
  ],
};

// bun read json file ehi.json
const ehiFile = Bun.file("ehi.json");

const ehiJson = await ehiFile.json();
// const efficientColumnCorrespondence = identifyEfficientColumnCorrespondence(
//   {
//     PAT_ENC_2: ehiJson["PAT_ENC_2"],
//     PAT_ENC_7: ehiJson["PAT_ENC_7"],
//   },
//   ehiJson.$meta.schemas
// );
// console.log(efficientColumnCorrespondence);
// const efficientColumnCorrespondence = identifyEfficientColumnCorrespondence(tables);

function findAndMergeSiblingTables(tables, schemas) {
  const allTables = Object.keys(tables).filter((k) => k !== "$meta");
  const siblingRelations = [];

  for (const table1 of allTables) {
    for (const table2 of allTables) {
      if (table1 >= table2) {
        continue;
      }
      const efficientColumnCorrespondence = identifyEfficientColumnCorrespondence(
        {
          [table1]: tables[table1],
          [table2]: tables[table2],
        },
        schemas,
        ["siblings"]
      );
      if (efficientColumnCorrespondence?.efficiency === 1) {
        siblingRelations.push(efficientColumnCorrespondence);
      }
    }
  }

  const mergedTables = { ...tables };
  const mergedSchemas = { ...schemas };

  // Build a graph representing the sibling relationships
  const graph = {};
  for (const relation of siblingRelations) {
    const { table1, table2 } = relation.correspondence;
    const schema1 = schemas[table1];
    const schema2 = schemas[table2];

    const isTable1Lesser =
      schema1.columns.length < schema2.columns.length ||
      (schema1.columns.length === schema2.columns.length && table1 < table2);

    const greaterTable = isTable1Lesser ? table2 : table1;
    const lesserTable = isTable1Lesser ? table1 : table2;

    if (!graph[greaterTable]) {
      graph[greaterTable] = [];
    }
    graph[greaterTable].push(lesserTable);
  }

  for (const greaterTable in graph) {
    graph[greaterTable].sort();
  }

  // Perform a topological sort on the graph
  const sortedTables = [];
  const visited = new Set();

  function visit(table) {
    if (visited.has(table)) {
      return;
    }
    visited.add(table);

    if (graph[table]) {
      for (const lesserTable of graph[table]) {
        visit(lesserTable);
      }
    }

    sortedTables.push(table);
  }

  for (const table of allTables) {
    visit(table);
  }

  // Merge the tables in the topologically sorted order
  for (const greaterTable of sortedTables) {
    if (graph[greaterTable]) {
      for (const lesserTable of graph[greaterTable]) {
        const relation = siblingRelations.find(
          (r) =>
            (r.correspondence.table1 === greaterTable &&
              r.correspondence.table2 === lesserTable) ||
            (r.correspondence.table1 === lesserTable &&
              r.correspondence.table2 === greaterTable)
        );

        const { column1, column2 } = relation.correspondence;
        const greaterColumns =
          relation.correspondence.table1 === greaterTable ? column1 : column2;
        const lesserColumns =
          relation.correspondence.table1 === greaterTable ? column2 : column1;

        const lesserTableData = tables[lesserTable];
        const lesserTableSchema = schemas[lesserTable];

        for (const lesserRow of lesserTableData) {
          const joinValues = lesserColumns.map((col) => "" + lesserRow[col]);
          const greaterRowIndex = mergedTables[greaterTable].findIndex((row) =>
            greaterColumns.every((col, i) => "" + row[col] === joinValues[i])
          );

          if (greaterRowIndex !== -1) {
            const greaterRow = mergedTables[greaterTable][greaterRowIndex];
            greaterRow["// begin sibling: " + lesserTable] = true;
            for (const [columnName, columnValue] of Object.entries(lesserRow).filter(([k, v]) => k !== "$meta")) {
              if (!(columnName in greaterRow) && !lesserColumns.includes(columnName)) {
                greaterRow[columnName] = columnValue;
              }
            }
            greaterRow.$meta = greaterRow.$meta || {};
            greaterRow.$meta.siblings = greaterRow.$meta.siblings || [];
            greaterRow.$meta.siblings.push(lesserRow.$meta.type);
          } else {
            throw "bad row" + JSON.stringify({greaterTable, lesserTable, greaterColumns, lesserColumns, lesserRow});
          }
        }

        for (const column of lesserTableSchema.columns) {
          if (!lesserColumns.includes(column.name) && !mergedSchemas[greaterTable].columns.some((c) => c.name === column.name)) {
            mergedSchemas[greaterTable].columns.push({...column, mergedFromSibling: lesserTable});
          }
        }

        delete mergedTables[lesserTable];
        delete mergedSchemas[lesserTable];
      }
    }
  }

  return { mergedTables, mergedSchemas };
}

// Usage
const { mergedTables, mergedSchemas } = findAndMergeSiblingTables(ehiJson, ehiJson.$meta.schemas);
const { mergedTables: finalTables, mergedSchemas: finalSchemas } = mergeSameNameTables(mergedTables, mergedSchemas);
console.log(JSON.stringify(finalTables, null, 2));
console.log(JSON.stringify(mergedTables, null, 2));
// console.log(mergedSchemas);
/*

 * don't allow LINE as a first/only column
 * Smarter way to restrict only to tables for which data exist -- like, first use all tables but filter out any who have only primary keys
 * If any table is involved in a relationship using *all of its columns*, the later table can be elimianted
*/
// const allTables = Object.keys(ehiJson).filter((k) => k !== "$meta")//.filter(k => k.startsWith("PAT_ENC_"));

// for (const table1 of allTables) {
//   for (const table2 of allTables) {
//     if (table1 >= table2) {
//       continue;
//     }
//     // console.log(table1, table2  )
//     const efficientColumnCorrespondence = identifyEfficientColumnCorrespondence(
//       {
//         [table1]: ehiJson[table1],
//         [table2]: ehiJson[table2],
//       },
//       ehiJson.$meta.schemas,
//       ["siblings"]
//     );
//     if (efficientColumnCorrespondence?.efficiency === 1) {
//       console.log(table1, table2, efficientColumnCorrespondence);
//     }
//   }
// }


function mergeSameNameTables(tables, schemas) {
  const mergedTables = {};
  const mergedSchemas = {};

  const normalize = (tableName) => tableName.replace(/[_\d]/g, "");

  for (const [normalizedName, tableNames] of Object.entries(
    _.groupBy(Object.keys(tables), normalize)
  )) {
    console.log(normalizedName, tableNames);
    if (tableNames.length > 1) {
      tableNames.sort();
      const baseName = tableNames[0];
      mergedTables[baseName] = tables[baseName];
      mergedSchemas[baseName] = schemas[baseName];

      const baseTablePrimaryKeys = schemas[baseName].primaryKey.map(
        (key) => key.columnName
      );

      for (let i = 1; i < tableNames.length; i++) {
        const mergingName = tableNames[i];
        const mergingTable = tables[mergingName];
        const mergingSchema = schemas[mergingName];

        for (const mergingRow of mergingTable) {
          const baseRowIndex = mergedTables[baseName].findIndex((baseRow) =>
            baseTablePrimaryKeys.every(
              (key) => baseRow[key] === mergingRow[key]
            )
          );

          if (baseRowIndex !== -1) {
            const baseRow = mergedTables[baseName][baseRowIndex];
            baseRow["// begin sibling: " + mergingName] = true;
            for (const [columnName, columnValue] of Object.entries(mergingRow).filter(([k, v]) => k !== "$meta")) {
              if (!baseTablePrimaryKeys.includes(columnName) && !(columnName in baseRow)) {
                baseRow[columnName] = columnValue;
              }
            }
            baseRow.$meta = baseRow.$meta || {};
            baseRow.$meta.merged = baseRow.$meta.merged || [];
            baseRow.$meta.merged.push(mergingRow.$meta.type);
          } else {
            mergedTables[baseName].push(mergingRow);
          }
        }

        for (const column of mergingSchema.columns) {
          if (!baseTablePrimaryKeys.includes(column.name) && !mergedSchemas[baseName].columns.some((c) => c.name === column.name)) {
            mergedSchemas[baseName].columns.push(column);
          }
        }
      }
    } else {
      const tableName = tableNames[0];
      mergedTables[tableName] = tables[tableName];
      mergedSchemas[tableName] = schemas[tableName];
    }
  }

  return { mergedTables, mergedSchemas };
}
// Usage
// const { mergedTables, mergedSchemas } = findAndMergeSiblingTables(ehiJson, ehiJson.$meta.schemas);
// const { mergedTables: finalTables, mergedSchemas: finalSchemas } = mergeSameNameTables(mergedTables, mergedSchemas);
// console.log(JSON.stringify(finalTables, null, 2));