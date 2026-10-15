// Keep Metro's working directory and Node module paths on the same Windows drive.
const fs = require('fs');
const path = require('path');

process.chdir(fs.realpathSync.native(process.cwd()));
process.argv.splice(1, 1);
process.argv[1] = path.resolve(process.cwd(), process.argv[1]);
require('module').runMain(process.argv[1]);
