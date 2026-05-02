import type { InfoCardType } from '@/types/canvas';

export const DEFAULT_INFO_CARD_TYPES: InfoCardType[] = [
  { id: 'contact',       name: 'Contact',       fields: ['Name', 'Phone', 'Email', 'Company', 'Address'], builtin: true },
  { id: 'basic-contact', name: 'Basic Contact', fields: ['Name', 'Phone', 'Email'], builtin: true },
  { id: 'product',       name: 'Product',       fields: ['Name', 'SKU', 'Price', 'Category', 'Description'], builtin: true },
  { id: 'note',          name: 'Note',          fields: ['Title', 'Content', 'Source'], builtin: true },
];
