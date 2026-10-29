import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 14. GET /api/bookings/stats => สรุปการจองที่มีเวลาเริ่มอยู่ในช่วง from ถึงก่อน to
// ต้องส่งทั้งคู่ เลือกกรอง roomId ได้ คืนจำนวนการจองและจำนวนชั่วโมงที่จอง แยกตามห้อง
// โดยรวมระยะเวลาเต็มของแต่ละรายการที่เข้าเงื่อนไข
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const roomIdParam = searchParams.get("roomId");

    // ต้องส่งทั้งคู่
    if (!from || !to) {
      return NextResponse.json(
        { error: "ต้องระบุพารามิเตอร์ from และ to ทั้งคู่" },
        { status: 400 }
      );
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: "รูปแบบวันเวลาของ from หรือ to ไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    if (fromDate >= toDate) {
      return NextResponse.json(
        { error: "ค่า from ต้องน้อยกว่า to" },
        { status: 400 }
      );
    }

    // เงื่อนไข: เวลาเริ่มอยู่ในช่วง from ถึงก่อน to (startTime >= fromDate && startTime < toDate)
    const where: any = {
      startTime: {
        gte: fromDate,
        lt: toDate,
      },
    };

    let filterRoomId: number | undefined = undefined;
    if (roomIdParam !== null && roomIdParam !== "") {
      const parsedRoomId = Number(roomIdParam);
      if (!Number.isInteger(parsedRoomId) || parsedRoomId <= 0) {
        return NextResponse.json(
          { error: "roomId ต้องเป็นจำนวนเต็มมากกว่า 0" },
          { status: 400 }
        );
      }
      filterRoomId = parsedRoomId;
      where.roomId = parsedRoomId;

      // Check room exists
      const room = await prisma.room.findUnique({
        where: { id: parsedRoomId },
      });
      if (!room) {
        return NextResponse.json(
          { error: "ไม่พบห้องประชุมที่ระบุ (Room not found)" },
          { status: 404 }
        );
      }
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        room: true,
      },
      orderBy: {
        startTime: "asc",
      },
    });

    // แยกตามห้อง โดยรวมระยะเวลาเต็มของแต่ละรายการที่เข้าเงื่อนไข
    const roomStatsMap = new Map<
      number,
      {
        roomId: number;
        roomCode: string;
        roomName: string;
        totalBookings: number;
        totalHours: number;
      }
    >();

    for (const b of bookings) {
      if (!roomStatsMap.has(b.roomId)) {
        roomStatsMap.set(b.roomId, {
          roomId: b.roomId,
          roomCode: b.room.roomCode,
          roomName: b.room.roomName,
          totalBookings: 0,
          totalHours: 0,
        });
      }

      const item = roomStatsMap.get(b.roomId)!;
      item.totalBookings += 1;

      // รวมระยะเวลาเต็มของแต่ละรายการที่เข้าเงื่อนไข (endTime - startTime) ในหน่วยชั่วโมง
      const durationHours =
        (b.endTime.getTime() - b.startTime.getTime()) / (1000 * 60 * 60);
      item.totalHours = Math.round((item.totalHours + durationHours) * 100) / 100;
    }

    // If roomId was requested and has 0 bookings, we still report it with 0 count/hours
    if (filterRoomId !== undefined && !roomStatsMap.has(filterRoomId)) {
      const room = await prisma.room.findUnique({ where: { id: filterRoomId } });
      if (room) {
        roomStatsMap.set(filterRoomId, {
          roomId: room.id,
          roomCode: room.roomCode,
          roomName: room.roomName,
          totalBookings: 0,
          totalHours: 0,
        });
      }
    }

    const stats = Array.from(roomStatsMap.values());

    return NextResponse.json(stats, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
