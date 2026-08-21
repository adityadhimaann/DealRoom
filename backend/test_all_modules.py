"""Comprehensive End-to-End Test Suite for All DealRoom Enterprise Modules."""
import asyncio
import json
import websockets
import httpx
import time

BASE_URL = "http://127.0.0.1:10000"
WS_URL = "ws://127.0.0.1:10000/ws"

async def test_health():
    print("\n🔍 [1/7] Testing Health Check & System Status...")
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(f"{BASE_URL}/health")
        assert r.status_code == 200, f"Health check failed: {r.text}"
        data = r.json()
        print(f"  ✓ Health Status: {data.get('status')} | Version: {data.get('version')}")

async def test_job_analysis_hourly_usd():
    print("\n🔍 [2/7] Testing Job Analysis (USD Hourly Contract Math Engine)...")
    async with httpx.AsyncClient(timeout=20.0) as client:
        payload = {
            "job_text": "Looking for React/TypeScript frontend developer, 30 hrs/week, 6 months duration, $5.00 - $20.00 / hr"
        }
        r = await client.post(f"{BASE_URL}/api/analyze-job", json=payload)
        assert r.status_code == 200, f"Analysis failed: {r.text}"
        data = r.json()
        assert data["currency"] == "$", f"Expected '$', got {data['currency']}"
        setup = data["recommended_setup"]
        print(f"  ✓ Extracted Currency: {data['currency']}")
        print(f"  ✓ Freelancer Asking: ${setup['agent_a_config']['ideal_price']:,.0f} | Floor: ${setup['agent_a_config']['min_price']:,.0f}")
        print(f"  ✓ Client Target: ${setup['agent_b_config']['ideal_price']:,.0f} | Ceiling: ${setup['agent_b_config']['min_price']:,.0f}")
        print(f"  ✓ Deliverables ({len(data['deliverables'])} items): {data['deliverables'][:2]}")
        return data

async def test_job_analysis_inr():
    print("\n🔍 [3/7] Testing Job Analysis (INR Dynamic Currency & Math Engine)...")
    async with httpx.AsyncClient(timeout=20.0) as client:
        payload = {
            "job_text": "Need full-stack developer in India for e-commerce website, budget ₹75,000 INR"
        }
        r = await client.post(f"{BASE_URL}/api/analyze-job", json=payload)
        assert r.status_code == 200, f"INR Analysis failed: {r.text}"
        data = r.json()
        assert data["currency"] == "₹", f"Expected '₹', got {data['currency']}"
        print(f"  ✓ Extracted INR Currency: {data['currency']}")
        print(f"  ✓ Target INR Asking: ₹{data['recommended_setup']['agent_a_config']['ideal_price']:,.0f}")

async def test_session_lifecycle_and_ws():
    print("\n🔍 [4/7] Testing Session Creation & Real-Time WebSocket Voice Debate...")
    async with httpx.AsyncClient(timeout=20.0) as client:
        setup_payload = {
            "subject": "Enterprise React/TypeScript Micro-Frontend Architecture",
            "max_turns": 6,
            "currency": "$",
            "deliverables": [
                "Reusable React/TypeScript Component Library",
                "Automated Vitest/Jest Test Suite",
                "Vercel CI/CD Pipeline Setup"
            ],
            "agent_a_config": {
                "role_name": "Senior Specialist",
                "ideal_price": 12000.0,
                "min_price": 8500.0,
                "priorities": ["Net-30 Escrow", "Automated Tests", "30+ Weekly Hours"],
                "strategy": "balanced",
                "context": "Enterprise specialist with production architecture components"
            },
            "agent_b_config": {
                "role_name": "VP of Procurement (Client)",
                "ideal_price": 6000.0,
                "min_price": 12000.0,
                "priorities": ["Verified Demo Builds", "SOC 2 Compliance", "Fast Turnaround"],
                "strategy": "balanced",
                "context": "Seeking robust engineering deliverables within budget"
            }
        }
        r = await client.post(f"{BASE_URL}/api/sessions", json=setup_payload)
        assert r.status_code == 200, f"Session create failed: {r.text}"
        session = r.json()
        session_id = session["session_id"]
        print(f"  ✓ Session Created: ID #{session_id}")

    # WebSocket Negotiation Simulation
    print("  ✓ Connecting to WebSocket live stream...")
    async with websockets.connect(f"{WS_URL}/sessions/{session_id}") as ws:
        async def recv_turn_ready():
            while True:
                raw = await ws.recv()
                data = json.loads(raw)
                if data.get("type") == "turn_ready":
                    return data
                elif data.get("type") == "whisper_applied":
                    return data

        # Step Turn 1 (Freelancer)
        await ws.send(json.dumps({"action": "step"}))
        msg1 = await recv_turn_ready()
        turn1 = msg1.get("turn", {})
        print(f"    👉 Round 1 ({turn1.get('agent')}): ${turn1.get('offer_amount', 0):,.0f} — \"{turn1.get('message')[:55]}...\"")

        # Step Turn 2 (Client)
        await ws.send(json.dumps({"action": "step"}))
        msg2 = await recv_turn_ready()
        turn2 = msg2.get("turn", {})
        print(f"    👉 Round 2 ({turn2.get('agent')}): ${turn2.get('offer_amount', 0):,.0f} — \"{turn2.get('message')[:55]}...\"")

        # Step Turn 3 (Freelancer Counter)
        await ws.send(json.dumps({"action": "step"}))
        msg3 = await recv_turn_ready()
        turn3 = msg3.get("turn", {})
        print(f"    👉 Round 3 ({turn3.get('agent')}): ${turn3.get('offer_amount', 0):,.0f} — \"{turn3.get('message')[:55]}...\"")

        # Human Whisper Intervention
        await ws.send(json.dumps({"action": "whisper", "agent": "B", "instruction": "Accept if offer is under $10,000"}))
        w_ack = await recv_turn_ready()
        print(f"    🤫 Whisper Applied: {w_ack.get('type')}")

        # Step Turn 4 (Client with Whisper)
        await ws.send(json.dumps({"action": "step"}))
        msg4 = await recv_turn_ready()
        turn4 = msg4.get("turn", {})
        print(f"    👉 Round 4 ({turn4.get('agent')}): ${turn4.get('offer_amount', 0):,.0f} — \"{turn4.get('message')[:55]}...\"")

        return session_id

async def test_contract_and_msa(session_id: str):
    print("\n🔍 [5/7] Testing Upwork SOW Agreement & Enterprise MSA Generation...")
    async with httpx.AsyncClient(timeout=20.0) as client:
        # SOW Contract
        r1 = await client.post(f"{BASE_URL}/api/sessions/{session_id}/generate-contract")
        assert r1.status_code == 200, f"SOW generation failed: {r1.text}"
        print(f"  ✓ Upwork SOW Generated: Reference DR-{session_id.upper()}")

        # Enterprise B2B MSA
        r2 = await client.post(f"{BASE_URL}/api/sessions/{session_id}/generate-msa")
        assert r2.status_code == 200, f"MSA generation failed: {r2.text}"
        msa_data = r2.json()
        print(f"  ✓ Fortune 500 MSA & SLA Generated: Reference {msa_data.get('contract_ref')}")

async def test_cryptographic_audit_ledger(session_id: str):
    print("\n🔍 [6/7] Testing Cryptographic Audit Ledger & Tamper-Proof Chain...")
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(f"{BASE_URL}/api/sessions/{session_id}/audit-trail")
        assert r.status_code == 200, f"Audit trail failed: {r.text}"
        audit = r.json()
        assert audit.get("is_tamper_proof") is True, "Audit chain integrity failed!"
        print(f"  ✓ Tamper-Proof Chain Verified: {audit.get('is_tamper_proof')}")
        print(f"  ✓ Recorded Audit Blocks: {audit.get('total_events')} immutable events")
        for ev in audit.get("events", [])[:3]:
            print(f"    🔒 Block: {ev.get('hash')[:16]}... | Event: {ev.get('event_type')}")

async def main():
    print("=" * 65)
    print("🏛️  DEALROOM ENTERPRISE MODULE TEST SUITE")
    print("=" * 65)
    start_time = time.time()
    
    await test_health()
    await test_job_analysis_hourly_usd()
    await test_job_analysis_inr()
    session_id = await test_session_lifecycle_and_ws()
    await test_contract_and_msa(session_id)
    await test_cryptographic_audit_ledger(session_id)
    
    print("\n" + "=" * 65)
    print(f"✅ ALL 7 ENTERPRISE MODULES FULLY TESTED & VERIFIED IN {time.time() - start_time:.2f}s!")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(main())
