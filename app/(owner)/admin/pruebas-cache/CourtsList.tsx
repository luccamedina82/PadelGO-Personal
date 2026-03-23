'use client'
import { CourtType } from "@/app/generated/prisma/browser";
import { useQuery } from "@tanstack/react-query";

interface InterfaceInitialData {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: Date;
    clubId: string;
    type: CourtType;
    covered: boolean;
    svgX: number;
    svgY: number;
    svgW: number;
    svgH: number;
}


export const CourtsList = ({ clubId, initialData }: { clubId: string; initialData: InterfaceInitialData[] }) => {
  const {data: courts} = useQuery({
    queryKey: ['courts', clubId],
    queryFn: () => fetch(`/api/clubs/${clubId}/courts`).then(res => res.json()),
    initialData,
    staleTime: 60 * 1000, // 1 minuto
    refetchOnWindowFocus: true,
  })
  return (
    <div>
      <h2>Canchas del club</h2>
      <ul>
        {courts.map((court: InterfaceInitialData) => (
          <li key={court.id}>{court.name}</li>
        ))}
      </ul>
    </div>
  )
}