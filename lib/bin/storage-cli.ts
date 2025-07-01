import yargs from 'yargs';
import { initCommand } from '../command/init.ts';
import { mkdirCommand } from '../command/mkdir.ts';
import { mvCommand } from '../command/mv.ts';

let parser = yargs()
	.strict()
	.help()
	.demandCommand();

[
	initCommand,
	mkdirCommand,
	mvCommand,
].forEach((command) => {
	parser = command(parser);
});


parser.parse(process.argv.slice(2));
