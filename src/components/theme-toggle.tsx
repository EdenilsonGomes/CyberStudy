"use client";
/* eslint-disable react-hooks/set-state-in-effect -- apply stored preference after mount */
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
export function ThemeToggle(){const[dark,setDark]=useState(true);useEffect(()=>{const saved=localStorage.getItem("theme");const next=saved?saved==="dark":true;setDark(next);document.documentElement.classList.toggle("dark",next)},[]);function toggle(){const next=!dark;setDark(next);localStorage.setItem("theme",next?"dark":"light");document.documentElement.classList.toggle("dark",next)}return <button className="btn btn-secondary" onClick={toggle} aria-label="Alternar tema">{dark?<Sun size={18}/>:<Moon size={18}/>}</button>}
