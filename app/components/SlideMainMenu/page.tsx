"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
    { href: "/schedule", label: "Розклад", icon: "📅" },
    { href: "/homeWork", label: "Домашні завдання", icon: "📚" },
    { href: "/absentStudents", label: "Відсутність", icon: "🗓️" },
];

export default function SideMainMenu() {
    const pathname = usePathname();

    return (
        <aside className="w-72 h-full flex flex-col gap-2 p-5 bg-[#566777] text-[#E6E6DA] shadow-xl">
            <h2 className="px-3 pb-4 mb-2 text-2xl font-bold tracking-wide border-b border-[#C2C5CE]/30">
                Меню
            </h2>

            <nav className="flex flex-col gap-2">
                {menuItems.map(({ href, label, icon }) => {
                    const isActive = pathname === href;

                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`
                                flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-medium
                                transition-all duration-200
                                ${
                                    isActive
                                        ? "bg-[#B6AA9A] text-[#520100] shadow-md"
                                        : "hover:bg-[#C2C5CE] hover:text-[#566777] hover:translate-x-1"
                                }
                            `}
                        >
                            <span className="text-xl">{icon}</span>
                            <span>{label}</span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}