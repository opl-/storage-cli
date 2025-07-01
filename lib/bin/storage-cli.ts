import yargs from 'yargs';
import { initCommand } from '../command/init.ts';
import { mkdirCommand } from '../command/mkdir.ts';

let parser = yargs()
	.strict()
	.help()
	.demandCommand();

[
	initCommand,
	mkdirCommand,
].forEach((command) => {
	parser = command(parser);
});


parser.parse(process.argv.slice(2));
