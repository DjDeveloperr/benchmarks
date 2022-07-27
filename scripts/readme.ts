import { markdownTable } from 'markdown-table';
import { duration } from '../node_modules/mitata/reporter/fmt.mjs';
import benchmarks from './benchmarks.json';
import { join, resolve } from 'path';
import { exec } from 'bun-utilities';

const __dirname = new URL('.', import.meta.url).pathname;

const getCPU = () => {
    if (process.platform === 'linux') {
        return exec(['bash', '-c', `lscpu | grep 'Model name' | cut -f 2 -d ":" | awk '{$1=$1}1'`]).stdout.replace(/\n|\r/g, '');
    }

    if (process.platform === 'darwin') {
        return exec(['bash', '-c', `sysctl -n machdep.cpu.brand_string'`]).stdout.replace(/\n|\r/g, '');
    }

    return 'unknown';
}

const sort = (a: any[], b: any[]) => {
    if (a.at(-1) > b.at(-1)) return 1;
    if (a.at(-1) < b.at(-1)) return -1;
  
    return 0;
}

let head = [
    `*Runned on ${getCPU()}*`,
    '',
    '## Table Of Contents',
    '',
    '- Benchmarks',
    ''
].join('\n');

let tables: Record<string, any[]> = {};
let markdown = '';

for (const benchmark of benchmarks) {
    head += `   - [${benchmark.name}](#${benchmark.name})${benchmark.category ? ` (${benchmark.category})` : ''}\n`;
    markdown += `## ${benchmark.name.at(0).toUpperCase() + benchmark.name.slice(1)}\n`;

    const path = resolve('.', benchmark.path, 'outputs');
    const outputs = {
        bun: JSON.parse(await Bun.file(join(path, 'bun.json')).text()),
        deno: JSON.parse(await Bun.file(join(path, 'deno.json')).text()),
        node: JSON.parse(await Bun.file(join(path, 'node.json')).text()),
    }

    for (const value of Object.values(outputs)) {
        for (const b of value.benchmarks) {
            tables[b.name] = tables[b.name] || [
                ['Runtime', 'Benchmark', 'Average', 'p75', 'p99', 'Min', 'Max']
            ];

            tables[b.name].push([
                value.runtime,
                b.benchmark,
                `${duration(b.stats.avg)}/iter`,
                duration(b.stats.min),
                duration(b.stats.p75),
                duration(b.stats.p99),
                duration(b.stats.max),
                b.stats.avg
            ]);
        }
    }

    const tempTables = [];
    for (const [key, table] of Object.entries(tables)) {
        table.sort(sort);
    
        tempTables.push(table.map(a => Object.assign([], a)));
        for (const b of table.slice(1)) b.pop();

        markdown += `\n### ${key}\n`
        markdown += `${markdownTable(table)}\n\n`;
    }

    if (tempTables[1]) {
        const flattedTablesArray = tempTables.flat();
        for (const element of flattedTablesArray.slice(1)) {
            if (element.join(',') === flattedTablesArray[0].join(',')) {
                flattedTablesArray.splice(flattedTablesArray.indexOf(element), 1);
            }
        }
        
        flattedTablesArray.sort(sort);
        for (const b of flattedTablesArray.slice(1)) b.pop();

        markdown += `\n### everything\n`;
        markdown += `${markdownTable(flattedTablesArray)}\n\n`;
    }

    tables = {};
}

await Bun.write(resolve(__dirname, '..', 'README.md'), `${head}\n${markdown}`);
