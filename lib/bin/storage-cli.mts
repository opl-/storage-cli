import yargs from 'yargs';
import { mkdirCommand } from '../command/mkdir.mts';

let parser = yargs()
	.strict()
	.help()
	.demandCommand();

[
	mkdirCommand,
].forEach((command) => {
	parser = command(parser);
});


parser.parse(process.argv.slice(2));
