const fs = require('fs');
const path = require('path');

// Directory where your compiled files are located
const directory = './dist'; // Adjust to your actual compiled JS folder path

// Function to update import statements to include `.js` if missing
function updateImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Match relative imports like './api/util' or '../api/users.js' (e.g., './api/util')
  content = content.replace(/(['"])([\.]+\/[^'"]+)(['"])/g, (match, p1, p2, p3) => {
    // If the path is relative and doesn't already have '.js' at the end
    if (!p2.endsWith('.js') && !p2.endsWith('.json') && !p2.includes('node_modules')) {
      return `${p1}${p2}.js${p3}`;
    }
    // Otherwise, leave it as is (even if it already has `.js`)
    return match;
  });

  // Write the updated content back to the file
  fs.writeFileSync(filePath, content, 'utf-8');
}

// Function to recursively traverse the directory and process each file
function updateImportsInDirectory(directory) {
  const files = fs.readdirSync(directory);
  files.forEach((file) => {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      // Recurse into subdirectories
      updateImportsInDirectory(filePath);
    } else if (filePath.endsWith('.js')) {
      // Modify only .js files (compiled files)
      updateImportsInFile(filePath);
    }
  });
}

// Start processing the compiled JS files
updateImportsInDirectory(directory);
console.log('Updated import statements in compiled JS files to include .js extension where necessary.');
