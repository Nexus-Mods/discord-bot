var fs = require('fs');

function deleteFolderRecursive(path) {
  if (fs.existsSync(path) && fs.lstatSync(path).isDirectory()) {
    fs.readdirSync(path).forEach(function(file, index) {
      var curPath = path + '/' + file;

      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      }
      else { // delete file
        fs.unlinkSync(curPath);
      }
    });

    // console.log(`Deleting directory "${path}"...`);
    fs.rmdirSync(path);
  }
}

console.log('Cleaning working tree...');

deleteFolderRecursive('./dist');
if (!fs.existsSync('./config.json')) fs.writeFileSync('./config.json', JSON.stringify({}), 'utf-8');

console.log('Successfully cleaned working tree!');