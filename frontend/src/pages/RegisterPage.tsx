import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await register(name, email, password);
      navigate("/");
    } 
    catch (err) {
        console.error(err);
        if (axios.isAxiosError(err) && err.response) setError(err.response.data?.message ?? "Registration failed");
        else setError("Could not reach the server — is it running?");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Register</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit">Register</button>
      <p>
        Have an account? <Link to="/login">Log in</Link>
      </p>
    </form>
  );
}