const { z } = require('zod');
const { zodSchema } = require('ai');

const schema = z.object({ patientId: z.string() });
console.log("Zod Schema:", schema);

try {
  const wrapped = zodSchema(schema);
  console.log("Wrapped:", wrapped.jsonSchema);
} catch (e) {
  console.error("Error wrapping:", e.message);
}
