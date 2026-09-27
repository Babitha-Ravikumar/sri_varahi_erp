const express = require("express");
const path = require("path");
const config = require("./config/env");
const { attachUser } = require("./middleware/auth");
const { notFound, errorHandler } = require("./middleware/errors");
const routes = require("./routes");
const migrate = require("./database/migrate");
const seed = require("./database/seed");

async function main() {
  await migrate();
  await seed();

  const app = express();
  app.use(express.json());
  // Static downloads (Android APK distribution for physical devices)
  app.use(
    "/downloads",
    express.static(path.join(__dirname, "../public/downloads")),
  );
  app.use(attachUser);
  app.use("/api", routes);
  app.use(notFound);
  app.use(errorHandler);

  app.listen(config.port, "0.0.0.0", () => {
    console.log(
      `Sri Varahi ERP backend listening on port ${config.port} (${config.env})`,
    );
  });
}

main().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});
