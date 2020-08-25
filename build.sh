# Install dependencies
npm install --no-package-lock \
  @discordjs/uws@^10.149.0 \
  request@^2.34

# Install packages
npm install
npm run build

node $WORK_DIR/dist/index.js
