function mergeRecords(baseName, schema, tables, primaryKeys, data) {
  tables.sort();
  console.error(tables[0], typeof schema, Object.keys(schema || {}))
  const mergedRecords = new Map();

  for (const table of tables) {
    for (const record of data[table]) {
      console.error(tables, primaryKeys, record['$meta'])
        console.error( schema[record['$meta']['type']]['primaryKey'])
      const pkValue = primaryKeys.map((pk, i) => record[
        schema[record['$meta']['type']]['primaryKey'][i]['columnName']
      ]).join('_');
      if (tables[0] === "ACCOUNT_CONTACT") {
        console.error("ACM", primaryKeys, pkValue, table, record)
      }
      if (!mergedRecords.has(pkValue)) {
        const newRecord = {'$meta': {
          type: baseName + "_MERGED"
        }};
        for (const [key, value] of Object.entries(record)) {
          if (primaryKeys.includes(key)) {
            newRecord[key] = value;
          }
        }
        mergedRecords.set(pkValue, newRecord);
      } 
      const existingRecord = mergedRecords.get(pkValue);
      for (const [key, value] of Object.entries(record)) {
        if (!primaryKeys.includes(key) && key !== '$meta') {
          existingRecord[key] = value;
        }
      }
    }
  }

  return Array.from(mergedRecords.values());
}

function identifyAndMergeTables(data) {
  const errorLog = [];
  const tableGroups = {};
  const transformedData = { '$meta': { 'schemas': {} } };

  Object.keys(data).forEach(table => {
    if (table === '$meta') return;
    const baseName = table.match(/(.+?)(_?\d*)$/)[1];
    tableGroups[baseName] = (tableGroups[baseName] || []).concat(table);
  });

  for (const [baseName, tables] of Object.entries(tableGroups)) {
    if (tables.length > 1) {
      const primaryKeys = data['$meta']['schemas'][tables[0]]['primaryKey'].map(pk => pk['columnName']);
      const mergedTable = mergeRecords(baseName, data['$meta']['schemas'], tables, primaryKeys, data);
      if (mergedTable.length) {
        transformedData[`${baseName}_MERGED`] = mergedTable;
        const schema = { ...data['$meta']['schemas'][tables[0]], 'name': `${baseName}_MERGED` };
        schema.columns =
          schema.columns.filter(col => primaryKeys.includes(col.columnName))
         .concat(
          tables
            .flatMap(table => (data['$meta']['schemas'][table].columns.map(c => ({ ...c, sourceTable: table })))
            .filter(col => !primaryKeys.includes(col.columnName))));

        transformedData['$meta']['schemas'][`${baseName}_MERGED`] = schema;
      } else {
        console.error(`Failed to merge tables for base name '${baseName}'.`, tables);
      }
    } else {
      const table = tables[0];
      transformedData[table] = data[table];
      transformedData['$meta']['schemas'][table] = data['$meta']['schemas'][table];
    }
  }

  return { transformedData, errorLog };
}

function main(data) {
  const { transformedData, errorLog } = identifyAndMergeTables(data);
  console.log(JSON.stringify(transformedData, null, 4));
  errorLog.forEach(error => console.error(error));
}

let inputData = '';
process.stdin.on('readable', () => {
  let chunk;
  while ((chunk = process.stdin.read()) !== null) {
    inputData += chunk;
  }
});

process.stdin.on('end', () => {
  const data = JSON.parse(inputData);
  main(data);
});
