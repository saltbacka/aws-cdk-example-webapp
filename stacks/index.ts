import { App, Stack, StackProps } from "aws-cdk-lib";

import { FrontendStack } from "./frontend-stack";

const packageInfo = require("../package.json");
const stage = "local";

class AppStack extends Stack {
  constructor(parent: App, name: string, props?: StackProps) {
    const resourceName = `${stage}-${packageInfo.name}-${name}`;
    super(parent, resourceName, props);

    new FrontendStack(this, "Frontend", {
      app: packageInfo.name,
      stage,
      // region: this.node.tryGetContext("region"),
    });
  }
}

const app = new App();

new AppStack(app, "App", {
  env: {
    region: "eu-west-1",
  }
});

app.synth();
