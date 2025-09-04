import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Load Supabase environment variables from Vercel
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const jwtSecret = process.env.SUPABASE_JWT_SECRET; // This is the JWT secret from your Supabase project

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { recipient, amount, verificationCode } = req.body;
    
    // Step 1: Get the JWT from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization token is required.' });
    }
    const token = authHeader.split(' ')[1];

    let userId;
    try {
        // Step 2: Verify the JWT and extract the user ID
        const decodedToken = jwt.verify(token, jwtSecret);
        userId = decodedToken.sub; // The user ID is in the 'sub' field
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    // Step 3: Input validation
    if (!userId || !recipient || typeof amount !== 'number' || amount <= 0 || !verificationCode) {
        return res.status(400).json({ message: 'Invalid data provided.' });
    }

    try {
        // Step 4: Get the current user's data from the database
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('userBalance, transferVerificationCode')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Step 5: Verify the transfer code
        if (userData.transferVerificationCode !== verificationCode) {
            return res.status(401).json({ message: 'Invalid transfer verification code.' });
        }

        // Step 6: Check for sufficient funds
        if (userData.userBalance < amount) {
            return res.status(400).json({ message: 'Insufficient funds for this transfer.' });
        }

        // Step 7: Perform the transaction securely
        const newBalance = userData.userBalance - amount;
        
        // This is where you would perform the atomic database transaction to update both sender and receiver balances.
        // For a full implementation, you'll need to use Supabase's transaction functionality or a stored procedure.
        
        // Example of a database update call:
        // const { data: updateData, error: updateError } = await supabase
        //     .from('users')
        //     .update({ userBalance: newBalance, transferVerificationCode: null })
        //     .eq('id', userId);

        return res.status(200).json({ 
            status: 'success', 
            message: `Transfer of $${amount.toFixed(2)} to ${recipient} initiated.`,
            newBalance: newBalance
        });

    } catch (error) {
        console.error('Transfer failed:', error);
        return res.status(500).json({ message: 'An internal error occurred during the transfer.' });
    }
}
