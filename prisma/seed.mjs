import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database room_reserve_db...");

  // Seed Rooms
  const sampleRooms = [
    {
      roomCode: "R101",
      roomName: "ห้องประชุมไพลิน (Pailin Hall)",
      capacity: 12,
      location: "อาคารวิศวกรรม 1 ชั้น 2",
    },
    {
      roomCode: "R201",
      roomName: "ห้องบอร์ดบริหาร (Executive Boardroom)",
      capacity: 25,
      location: "อาคารอำนวยการ ชั้น 4",
    },
    {
      roomCode: "R301",
      roomName: "ห้องประชุมใหญ่ทองกวาว (Grand Hall)",
      capacity: 60,
      location: "ศูนย์ประชุม อาคาร 3 ชั้น 1",
    },
    {
      roomCode: "R401",
      roomName: "ห้องนวัตกรรม (Innovation & AI Lab)",
      capacity: 16,
      location: "อาคารนวัตกรรม ชั้น 3",
    },
    {
      roomCode: "R501",
      roomName: "ห้องประชุมไฮบริด (Hybrid Studio)",
      capacity: 8,
      location: "อาคารเทคโนโลยี ชั้น 2",
    },
  ];

  for (const r of sampleRooms) {
    await prisma.room.upsert({
      where: { roomCode: r.roomCode },
      update: {
        roomName: r.roomName,
        capacity: r.capacity,
        location: r.location,
      },
      create: r,
    });
  }

  const roomR101 = await prisma.room.findUnique({ where: { roomCode: "R101" } });
  const roomR201 = await prisma.room.findUnique({ where: { roomCode: "R201" } });
  const roomR401 = await prisma.room.findUnique({ where: { roomCode: "R401" } });

  // Seed sample upcoming bookings
  const now = new Date();
  const day1Start = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  day1Start.setHours(9, 0, 0, 0);
  const day1End = new Date(day1Start.getTime() + 2 * 60 * 60 * 1000);

  const day2Start = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  day2Start.setHours(13, 30, 0, 0);
  const day2End = new Date(day2Start.getTime() + 3 * 60 * 60 * 1000);

  const day3Start = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  day3Start.setHours(10, 0, 0, 0);
  const day3End = new Date(day3Start.getTime() + 2 * 60 * 60 * 1000);

  if (roomR101 && roomR201 && roomR401) {
    const existingBookings = await prisma.booking.count();
    if (existingBookings < 3) {
      await prisma.booking.createMany({
        data: [
          {
            roomId: roomR101.id,
            bookerName: "อาจารย์กิตติศักดิ์",
            purpose: "ประชุมเตรียมการสอนภาคปลาย",
            startTime: day1Start,
            endTime: day1End,
            attendeeCount: 8,
          },
          {
            roomId: roomR201.id,
            bookerName: "ดร.วิภาดา วิจิตรศิลป์",
            purpose: "ประชุมกรรมการบริหารประจำเดือน",
            startTime: day2Start,
            endTime: day2End,
            attendeeCount: 18,
          },
          {
            roomId: roomR401.id,
            bookerName: "ทีมวิจัย AI & Robotics",
            purpose: "อบรมการใช้งาน Agentic System",
            startTime: day3Start,
            endTime: day3End,
            attendeeCount: 12,
          },
        ],
      });
    }
  }

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
