# Use Node 18
FROM node:18-slim

# Required for the 'sharp' library to process images on Linux
RUN apt-get update && apt-get install -y libvips-dev

WORKDIR /usr/src/app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy the rest of the code (including the server folder)
COPY . .

# Set the startup command to your specific server file
CMD [ "node", "server/index.js" ]