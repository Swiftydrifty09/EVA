const tools = [
  {
    type: "function",
    function: {
      name: "get_time",
      description: "Get current time",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  }
];

async function runTool(name, args) {
  switch (name) {
    case "get_time":
      return new Date().toLocaleTimeString();
    default:
      return "Tool not found";
  }
}

module.exports = {
  tools,
  runTool
};