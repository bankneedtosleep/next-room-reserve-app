import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 7. GET /api/rooms/available => ค้นหาห้องว่าง
// ต้องส่ง startTime, endTime และเลือกส่ง attendeeCount ได้
// แสดงเฉพาะห้องที่ไม่มีการจองทับซ้อนและมีความจุเพียงพอ
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startTime = searchParams.get("startTime");
    const endTime = searchParams.get("endTime");
    const attendeeCount = searchParams.get("attendeeCount");

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: "ต้องระบุ startTime และ endTime ในการค้นหาห้องว่าง" },
        { status: 400 }
      );
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "รูปแบบวันเวลาของ startTime หรือ endTime ไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: "startTime ต้องน้อยกว่า endTime" },
        { status: 400 }
      );
    }

    let parsedAttendeeCount: number | undefined = undefined;
    if (attendeeCount !== null && attendeeCount !== "") {
      parsedAttendeeCount = Number(attendeeCount);
      if (!Number.isInteger(parsedAttendeeCount) || parsedAttendeeCount <= 0) {
        return NextResponse.json(
          { error: "attendeeCount ต้องเป็นจำนวนเต็มมากกว่า 0" },
          { status: 400 }
        );
      }
    }

    // Query rooms that have sufficient capacity and NO overlapping bookings
    // An overlapping booking satisfies: booking.startTime < requestedEndDate AND booking.endTime > requestedStartDate
    const availableRooms = await prisma.room.findMany({
      where: {
        ...(parsedAttendeeCount ? { capacity: { gte: parsedAttendeeCount } } : {}),
        bookings: {
          none: {
            startTime: { lt: endDate },
            endTime: { gt: startDate },
          },
        },
      },
      orderBy: {
        capacity: "asc",
      },
    });

    return NextResponse.json(availableRooms, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
