"use client";
import Link from "next/link";
import Image from "next/image";

const Navbar = () => {
    return (
        <nav className="bg-blue-400 text-white py-4 shadow-md">
            <div className="max-w-7xl mx-auto flex justify-between items-center px-6">
                <Link href="/">
                    <Image src="/IMPSlogo.png" alt="logo" width={74} height={29} className="cursor-pointer" />
                </Link>

                <div className="hidden md:flex space-x-6">
                    <Link href="/about" className="hover:text-gray-200">About</Link>
                    <Link href="/package" className="hover:text-gray-200">Package</Link>
                    <Link href="/customer" className="hover:text-gray-200">Customer</Link>
                    <Link href="/contract" className="hover:text-gray-200">Contract</Link>
                    <Link href="/dashboard" className="hover:text-gray-200">Dashboard</Link>
                </div>

                <div className="space-x-4">
                    <Link href="/login" className="bg-white text-blue-500 px-4 py-2 rounded-md hover:bg-gray-200">Login</Link>
                    <Link href="/register" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-800">Register</Link>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
