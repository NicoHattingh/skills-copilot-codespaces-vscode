import { MessageDefinition, MessageLayoutItem } from "./types";

export function collectFieldsFromLayout(layout: MessageLayoutItem[]): string[] {
  const fields: string[] = [];

  const visit = (items: MessageLayoutItem[]) => {
    for (const item of items) {
      if ("ref" in item) {
        fields.push(item.ref);
      } else if ("children" in item) {
        visit(item.children);
      }
    }
  };

  visit(layout);
  return fields;
}

export function getMessageFieldSet(message: MessageDefinition): Set<string> {
  return new Set(collectFieldsFromLayout(message.layout));
}
