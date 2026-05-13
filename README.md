Setting Up a Playwright Project
This document outlines the steps to set up a Playwright project on your local machine.

Prerequisites

Operating System: Windows, macOS, or Linux
NodeJS LTS 20: Make sure you have Node version 16.x or later installed. You can check your version by running node -v in your terminal. If you don't have it installed, download the appropriate installer from the official Node.js website https://nodejs.org/en
Stable internet connection: You'll need an internet connection to download required packages.
Installation

Open your terminal: Launch your command prompt (Windows) or terminal (macOS/Linux).
Install dependencies: Run the following command to install the necessary dependencies for your project:
```
npm install
```

Install Playwright: Install Playwright and its dependencies using the following commands:
```
npx playwright install
npx playwright install-deps
```

Running the Project

Copy config from json.sample:
```
jooble.json
kitalulus.json
seek.json
glints.js

npm run dev:kitalulus
npm run dev:seek
npm run dev:glints
npm run dev:jooble
```


Building the Project locally

Run build script: Assuming your project has a build script defined in a package.json file, run the following command to execute it:
```
npm run build
```

Run with docker: Assuming your have installed docker, run the following command to execute it:
Build
```
docker build -t playwright-runner . 
```
Run background mode
```
docker run -d --name playwright-runner-jooble -v ./db:/app/db --rm playwright-runner:latest npm run xvfb:jooble
docker run -d --name playwright-runner-kitalulus -v ./db:/app/db --rm playwright-runner:latest npm run xvfb:kitalulus
docker run -d --name playwright-runner-pintarnya -v ./db:/app/db --rm playwright-runner:latest npm run xvfb:pintarnya
docker run -d --name playwright-runner-glints -v ./db:/app/db --rm playwright-runner:latest npm run xvfb:glints
```
Run foreground mode
```
docker run -it --name playwright-runner-jooble -v ./db:/app/db --rm playwright-runner:latest npm run xvfb:jooble
docker run -it --name playwright-runner-kitalulus -v ./db:/app/db --rm playwright-runner:latest npm run xvfb:kitalulus
docker run -it --name playwright-runner-pintarnya -v ./db:/app/db --rm playwright-runner:latest npm run xvfb:pintarnya
docker run -it --name playwright-runner-glints -v ./db:/app/db --rm playwright-runner:latest npm run xvfb:glints
```
This command will create and run a Docker container named "playwright-runner-pintarnya" using the "playwright-runner:latest" image. It will also mount the "./db" directory from your local machine to the "/app/db" directory inside the container.

This document provides a basic guide to setting up a Playwright project. The specific steps for building your project might vary depending on your project structure and configuration.