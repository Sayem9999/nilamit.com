import { NextResponse } from 'next/server';

export async function GET() {
  const csvContent = 'title,description,category,startingPrice,durationHours\n' +
    'Sample Item,This is a high-quality auction item.,electronics,500,48\n' +
    'Another Item,Great condition and rare find.,fashion,1200,24';

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename=nilamit_bulk_template.csv',
    },
  });
}
