import Link from "next/link";


export default function SideMainMenu() {

    return (
        <>
            <div className="bg-gray-500 w-1/2 h-full flex flex-col p-4 text-xl text-white">
                <div><Link href={"/schedule"}><h3>Розклад</h3></Link></div>
                <div><Link href={"/homeWork"}><h3>Домашні завдання</h3></Link></div>
                <div><Link href={"/absentStudents"}><h3>Відсутність</h3></Link></div>
            </div>
        </>
    )
}