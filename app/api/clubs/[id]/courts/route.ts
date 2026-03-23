import { getCourtsByClub } from "@/lib/dal/pruebas"
import { NextResponse } from "next/server"



export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const data = await getCourtsByClub(id)
    return NextResponse.json(data)
}
