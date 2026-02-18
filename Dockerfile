# 1. Use Node 18
FROM node:18-slim

# 2. Install dependencies for the 'sharp' library used in index.js
RUN apt-get update && apt-get install -y libvips-dev

WORKDIR /usr/src/app

# 3. Copy package files and install
COPY package*.json ./
RUN npm install --only=production

# 4. Copy everything else (including the server folder)
COPY . .

# 5. Set environment to production
ENV NODE_ENV=production

# 6. Start the server using the path to your file
CMD [ "node", "server/index.js" ]