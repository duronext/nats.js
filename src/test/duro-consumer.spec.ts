import {
  connect,
  NatsConnection,
  JetStreamClient,
  StringCodec,
  JsMsg,
} from "nats";
import { consumeMessages, ConsumerOptions } from "../duro-consumer";
import { exec } from "child_process";
import util from "util";
import path from "path";

const execPromise = util.promisify(exec);

describe("JetStream Integration Tests", () => {
  let nc: NatsConnection;
  let js: JetStreamClient;
  const sc = StringCodec();
  const streamName = "testStream";
  const subject = "test.subject";
  const consumerName = "testConsumer1";
  const messageData1 = {
    id: "test-id-1",
    data: "test-data-1" + Math.random(),
    subject,
    timestamp: new Date().toISOString(),
  };
  const messageData2 = {
    id: "test-id-2",
    data: "test-data-2" + Math.random(),
    subject,
    timestamp: new Date().toISOString(),
  };

  const DOCKER_COMPOSE_FILE = "./src/test/docker-compose.yml";

  beforeAll(async () => {
    try {
      await execPromise(`docker compose -f ${DOCKER_COMPOSE_FILE} up -d`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      nc = await connect({ servers: "nats://localhost:5222" });
      js = nc.jetstream();
      const jsm = await js.jetstreamManager();
      await jsm.streams.add({ name: streamName, subjects: [subject] });
      await js.publish(subject, sc.encode(JSON.stringify(messageData1)));
      await js.publish(subject, sc.encode(JSON.stringify(messageData2)));
    } catch (error) {
      console.error(error);
    }

    // Wait for NATS server to be ready (adjust as needed for your system)
  });

  afterAll(async () => {
    await nc.drain();
    await execPromise(`docker compose -f ${DOCKER_COMPOSE_FILE} down`);
  });

  it("should create a consumer and process messages", async () => {
    const processMessage = jest.fn(async (msg: JsMsg) => {
      console.log("Processing message:", msg.data);
      expect(msg.data).toBeDefined();
      expect(msg.data.toString()).toContain("test-data-1");
      stopSignal.stop = true; // Set stop signal to exit the loop
    });

    const stopSignal = { stop: false }; // Signal to stop the loop
    const consumerOptions: ConsumerOptions = {
      streamName,
      subjects: [subject],
      consumerName,
      js,
      processMessage,
    };
    await Promise.race([consumeMessages(consumerOptions, stopSignal)]);
  });
});