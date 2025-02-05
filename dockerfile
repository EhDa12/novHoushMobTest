# Node
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of your app source code into the container
COPY . .

# Expose port 3000 from the container
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
