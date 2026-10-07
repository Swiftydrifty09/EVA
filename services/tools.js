const tools = [
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Get the current date and time, optionally in an IANA time zone such as Europe/Paris.",
      parameters: {
        type: "object",
        properties: {
          timeZone: {
            type: "string",
            description: "Optional IANA time zone. Omit to use the server's local time zone."
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_system_status",
      description: "Get current CPU and available GPU utilization for the computer running JARVIS.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  }
];

async function runTool(name, args = {}, { getSystemStatus } = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Tool arguments must be a JSON object.");
  }

  switch (name) {
    case "get_current_time": {
      const allowedKeys = new Set(["timeZone"]);
      if (Object.keys(args).some((key) => !allowedKeys.has(key))) {
        throw new Error("Unexpected argument for get_current_time.");
      }
      const timeZone = args.timeZone;
      if (timeZone !== undefined && (typeof timeZone !== "string" || timeZone.length > 100)) {
        throw new Error("timeZone must be a valid IANA time-zone name.");
      }

      const now = new Date();
      const options = { dateStyle: "full", timeStyle: "long" };
      if (timeZone) options.timeZone = timeZone;
      return { iso: now.toISOString(), formatted: new Intl.DateTimeFormat("en", options).format(now) };
    }
    case "get_system_status": {
      if (Object.keys(args).length) {
        throw new Error("get_system_status does not accept arguments.");
      }
      if (typeof getSystemStatus !== "function") {
        throw new Error("System status is unavailable.");
      }
      return await getSystemStatus();
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

module.exports = { tools, runTool };
