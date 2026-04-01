export async function getCurrentTime() {
  return new Date().toLocaleString();
}

export function calculate(expression) {
  try {
    return eval(expression); // ⚠️ safe only if you control input
  } catch {
    return "Invalid expression";
  }
}

export async function searchWeb(query) {
  // Placeholder – later connect to a search API
  return `Search results for: ${query}`;
}