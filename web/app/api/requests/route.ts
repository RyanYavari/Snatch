import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Request, RequestStatus } from '@/lib/models/Request';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const budget = formData.get('budget');

    if (!imageFile) {
      return NextResponse.json(
        { error: 'Image file is required' },
        { status: 400 }
      );
    }

    if (!budget || isNaN(Number(budget))) {
      return NextResponse.json(
        { error: 'Valid budget is required' },
        { status: 400 }
      );
    }

    // Convert file to base64 or store URL
    // For simplicity, we'll create a data URL
    // In production, you'd upload to cloud storage (S3, Cloudinary, etc.)
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');
    const imageUrl = `data:${imageFile.type};base64,${base64Image}`;

    // Create new request
    const newRequest = new Request({
      status: RequestStatus.NEW,
      budget: Number(budget),
      target_item: {
        image_url: imageUrl,
        image_embedding: [], // 2048-dim, will be populated by Scout agent
        metadata_embedding: [], // 2048-dim, optional
      },
      alternatives: [],
      negotiation_history: [],
    });

    const savedRequest = await newRequest.save();

    return NextResponse.json(
      {
        success: true,
        request: {
          id: savedRequest._id,
          status: savedRequest.status,
          budget: savedRequest.budget,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating request:', error);
    return NextResponse.json(
      { error: 'Failed to create request', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const req = await Request.findById(id);
      if (!req) {
        return NextResponse.json(
          { error: 'Request not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ request: req });
    }

    // Get all requests
    const requests = await Request.find({}).sort({ createdAt: -1 }).limit(50);
    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error('Error fetching requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests', details: error.message },
      { status: 500 }
    );
  }
}
