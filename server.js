"use strict";

const http = require("http");
const fs = require("fs");
const { MongoClient } = require("mongodb");
const MQL = require(__dirname + "/backend/musicql.js");

let db;

// 7999 for dev and 1867 for prod
const port = 1867;

const pdfDir = "/pdf_scores/";
const musicxmlDir = "/musicxml_scores/";

const mongoUri = "mongodb://127.0.0.1:27017";
const dbName = "askToscanini";

const send404Response = (response) => {
  response.writeHead(404, { "Content-Type": "text/plain" });
  response.write("Error 404: Page not found");
  response.end();
};

const send500Response = (response, message = "Internal server error") => {
  response.writeHead(500, { "Content-Type": "text/plain" });
  response.end(message);
};

const serveFile = (response, relPath, contentType) => {
  const readStream = fs.createReadStream(relPath);

  readStream.on("open", () => {
    response.writeHead(200, { "Content-Type": contentType });
    readStream.pipe(response);
  });

  readStream.on("error", () => {
    send404Response(response);
    console.log("file not found " + relPath);
  });
};

const handleGet = (request, response) => {
  if (request.url === "/") {
    serveFile(response, __dirname + "/frontend/index.html", "text/html");
  } else if (request.url === "/info") {
    serveFile(response, __dirname + "/frontend/info.html", "text/html");
  } else if (request.url === "/materialize.css") {
    serveFile(response, __dirname + "/frontend/materialize.css", "text/css");
  } else if (request.url === "/styles.css") {
    serveFile(response, __dirname + "/frontend/styles.css", "text/css");
  } else if (request.url === "/main.js") {
    serveFile(response, __dirname + "/frontend/main.js", "text/javascript");
  } else if (request.url.includes(musicxmlDir) && request.url.includes(".xml")) {
    const scoreName = request.url.replace(musicxmlDir, "");
    const relPath = __dirname + musicxmlDir + scoreName;
    serveFile(response, relPath, "text/xml");
  } else if (request.url.includes(pdfDir) && request.url.includes(".pdf")) {
    const scoreName = request.url.replace(pdfDir, "");
    const relPath = __dirname + pdfDir + scoreName;
    serveFile(response, relPath, "application/pdf");
  } else {
    send404Response(response);
  }
};

const handlePost = (request, response) => {
  let requestBody = "";
  let tooLarge = false;

  request.on("data", (data) => {
    requestBody += data;

    if (requestBody.length > 4096) {
      tooLarge = true;
      response.writeHead(413, "Request Entity Too Large", {
        "Content-Type": "text/html",
      });
      response.end("<html>failed</html>");

      // Stop reading more data.
      request.destroy();
    }
  });

  request.on("end", async () => {
    if (tooLarge) {
      return;
    }

    console.log("requestBody", requestBody);

    const queryString = requestBody.toLowerCase();

    try {
      console.time("took");

      const mongoQueryObj =
        queryString === "lucky" || queryString.length === 0
          ? {}
          : MQL.parse(queryString)[1];

      console.log("mongoQueryObj", JSON.stringify(mongoQueryObj));

      const scoreNames = await db
        .collection("scoreFacts")
        .distinct("_id", mongoQueryObj);

      let result;

      if (queryString === "lucky") {
        const randomNum = Math.floor(Math.random() * scoreNames.length);
        result = scoreNames[randomNum];
      } else {
        result = JSON.stringify(scoreNames);
      }

      console.timeEnd("took");

      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end(result);

      console.log("result", result);
    } catch (err) {
      console.error(err);

      // Preserve old parser-error response behavior when available.
      if (err.location && err.expected && err.expected[0]) {
        const errPos = err.location.start.offset;
        const beforeAndIndex = queryString.substr(0, errPos).lastIndexOf("and");

        // condition should account for clause being first
        const clauseStart = beforeAndIndex !== -1 ? beforeAndIndex + 3 : 0;

        const afterAnd = queryString
          .substr(clauseStart, queryString.length)
          .indexOf("and");

        // condition should account for clause being last
        const clauseEnd = afterAnd !== -1 ? afterAnd : queryString.length;

        const errorClause = queryString.substr(clauseStart, clauseEnd);
        const semanticError = err.expected[0].description;

        const errResponseObj = {
          errorClause: errorClause,
          semanticError: semanticError,
        };

        console.log("errResponseObj", JSON.stringify(errResponseObj));

        response.writeHead(200, { "Content-Type": "text/plain" });
        response.end(JSON.stringify(errResponseObj));
      } else {
        send500Response(response, "Database or server error");
      }
    }
  });
};

const onRequest = (request, response) => {
  if (request.method === "GET") {
    handleGet(request, response);
  } else if (request.method === "POST") {
    handlePost(request, response);
  } else {
    console.log("bad request, will send 404");
    send404Response(response);
  }
};

async function main() {
  const client = new MongoClient(mongoUri);

  await client.connect();

  db = client.db(dbName);

  console.log("Connected successfully to MongoDB");

  const server = http.createServer(onRequest);

 // server.listen(port, "0.0.0.0", () => {
 //   console.log("Server running at http://0.0.0.0:" + port + "/");
 // });

  server.listen(port, "127.0.0.1", () => {
    console.log("Server running at http://127.0.0.1:" + port + "/");
  });
}

main().catch((err) => {
  console.error("Failed to start server:");
  console.error(err);
  process.exit(1);
});
