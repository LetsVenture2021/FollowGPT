import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new (Ajv as any)({ allErrors: true, strict: false });
(addFormats as any)(ajv);

export function validate(schema: object, data: unknown) {
  const fn = ajv.compile(schema);
  if (!fn(data)) {
    const msg = fn.errors?.map((e) => `${e.instancePath} ${e.message}`).join("; ") || "Invalid input";
    throw new Error(msg);
  }
}
