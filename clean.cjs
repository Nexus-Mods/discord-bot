var fs = require('fs');

function deleteFolderRecursive(path) {
  if (fs.existsSync(path) && fs.lstatSync(path).isDirectory()) {
    fs.readdirSync(path).forEach(function(file, index) {
      var curPath = path + '/' + file;

      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      }
      else if (curPath.endsWith('config.json')) return; // skip config.json
      else { // delete file
        fs.unlinkSync(curPath);
      }
    });

    console.log(`Deleting directory "${path}"...`);
    fs.rmdirSync(path);
  }
}

console.log('Cleaning working tree...');

deleteFolderRecursive('./dist');
if (!fs.existsSync('./src/config.json')) fs.writeFileSync('./src/config.json', JSON.stringify({}), 'utf-8');

console.log('Successfully cleaned working tree!');