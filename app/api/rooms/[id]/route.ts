import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

// 3. GET /api/rooms/[id] => แสดงรายละเอียดห้องหนึ่งรายการ หากไม่พบให้ตอบ 404
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: rawId } = await Promise.resolve(context.params);
    const id = Number(rawId);

    if (isNaN(id) || !Number.isInteger(id)) {
      return NextResponse.json({ error: "รหัสห้อง (ID) ไม่ถูกต้อง" }, { status: 400 });
    }

    const room = await prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      return NextResponse.json({ error: "ไม่พบข้อมูลห้องประชุม (Room not found)" }, { status: 404 });
    }

    return NextResponse.json(room, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// 4. PATCH /api/rooms/[id] => แก้ไขบางฟิลด์ ฟิลด์ที่ไม่ส่งมาต้องคงเดิม
// รหัสห้องห้ามซ้ำ และห้ามลดความจุจนต่ำกว่าจำนวนผู้เข้าร่วมของรายการจองที่ยังไม่สิ้นสุด
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: rawId } = await Promise.resolve(context.params);
    const id = Number(rawId);

    if (isNaN(id) || !Number.isInteger(id)) {
      return NextResponse.json({ error: "รหัสห้อง (ID) ไม่ถูกต้อง" }, { status: 400 });
    }

    const existingRoom = await prisma.room.findUnique({
      where: { id },
    });

    if (!existingRoom) {
      return NextResponse.json({ error: "ไม่พบข้อมูลห้องประชุม (Room not found)" }, { status: 404 });
    }

    const body = await request.json();
    const { roomCode, roomName, capacity, location } = body;

    const dataToUpdate: any = {};

    // Validate roomCode if provided
    if (roomCode !== undefined) {
      if (typeof roomCode !== "string" || roomCode.trim() === "") {
        return NextResponse.json({ error: "roomCode ต้องเป็นข้อความและห้ามว่าง" }, { status: 400 });
      }
      const trimmedCode = roomCode.trim();
      if (trimmedCode !== existingRoom.roomCode) {
        const codeConflict = await prisma.room.findFirst({
          where: {
            roomCode: trimmedCode,
            NOT: { id },
          },
        });
        if (codeConflict) {
          return NextResponse.json(
            { error: "รหัสห้องนี้มีอยู่แล้วในระบบ (roomCode already exists)" },
            { status: 409 }
          );
        }
      }
      dataToUpdate.roomCode = trimmedCode;
    }

    // Validate roomName if provided
    if (roomName !== undefined) {
      if (typeof roomName !== "string" || roomName.trim() === "") {
        return NextResponse.json({ error: "roomName ต้องเป็นข้อความและห้ามว่าง" }, { status: 400 });
      }
      dataToUpdate.roomName = roomName.trim();
    }

    // Validate location if provided
    if (location !== undefined) {
      if (typeof location !== "string" || location.trim() === "") {
        return NextResponse.json({ error: "location ต้องเป็นข้อความและห้ามว่าง" }, { status: 400 });
      }
      dataToUpdate.location = location.trim();
    }

    // Validate capacity if provided
    if (capacity !== undefined) {
      const parsedCapacity = Number(capacity);
      if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
        return NextResponse.json({ error: "capacity ต้องเป็นจำนวนเต็มมากกว่า 0" }, { status: 400 });
      }

      // Check ongoing/active bookings that haven't ended yet (endTime >= now)
      const now = new Date();
      const activeBookings = await prisma.booking.findMany({
        where: {
          roomId: id,
          endTime: { gte: now },
        },
      });

      const maxAttendee = activeBookings.reduce(
        (max, b) => Math.max(max, b.attendeeCount),
        0
      );

      if (parsedCapacity < maxAttendee) {
        return NextResponse.json(
          {
            error: `ห้ามลดความจุจนต่ำกว่าจำนวนผู้เข้าร่วมของรายการจองที่ยังไม่สิ้นสุด (ต้องการความจุอย่างน้อย ${maxAttendee})`,
          },
          { status: 400 }
        );
      }

      dataToUpdate.capacity = parsedCapacity;
    }

    const updatedRoom = await prisma.room.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedRoom, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// 5. DELETE /api/rooms/[id] => ลบห้องได้เฉพาะห้องที่ไม่มีรายการจองเลย หากมีรายการจองให้ตอบ 409
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: rawId } = await Promise.resolve(context.params);
    const id = Number(rawId);

    if (isNaN(id) || !Number.isInteger(id)) {
      return NextResponse.json({ error: "รหัสห้อง (ID) ไม่ถูกต้อง" }, { status: 400 });
    }

    const existingRoom = await prisma.room.findUnique({
      where: { id },
    });

    if (!existingRoom) {
      return NextResponse.json({ error: "ไม่พบข้อมูลห้องประชุม (Room not found)" }, { status: 404 });
    }

    const bookingCount = await prisma.booking.count({
      where: { roomId: id },
    });

    if (bookingCount > 0) {
      return NextResponse.json(
        { error: `ไม่สามารถลบห้องนี้ได้เนื่องจากมีรายการจองอยู่ (${bookingCount} รายการ)` },
        { status: 409 }
      );
    }

    await prisma.room.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "ลบห้องประชุมสำเร็จ", id },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
