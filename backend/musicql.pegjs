//TODO check query length to begin with!
//^should this only be done serverside?
{
  const queryObj ={$and:[]};
  const cm = require("concertmaster");
}

start
	= _(clause)(_"and"_ clause)*_

clause = (musicTerm / instrumentRange / composerInstrument)
{
	return queryObj;
}

instrumentRange = instrument:([a-zA-Z0-9])+ _ min:([a-gA-G][b|#]?[0-9]) _ max:([a-gA-G][b|#]?[0-9])
{
    const rangeQuery = {"instrumentRanges": {"$elemMatch": {} } };
    const minPitch = cm.noteStringToMidiNum(min.join("", 10));
    const maxPitch = cm.noteStringToMidiNum(max.join("", 10));

    if (minPitch < maxPitch)
    {
      rangeQuery.instrumentRanges.$elemMatch["instrumentName"] = {$regex: instrument.join("")};
      rangeQuery.instrumentRanges.$elemMatch["minPitch"] = {$gte: minPitch};  
      rangeQuery.instrumentRanges.$elemMatch["maxPitch"] = {$lte: maxPitch};
      queryObj.$and.push(rangeQuery);    
    }
    else
    {
      expected("pitch range should be from low to high");
    }
}

composerInstrument = ci:([a-zA-Z0-9]+)
{
        const CI = {$regex:ci.join("")};
	queryObj.$and.push({$or: [{"_id": CI}, {"instrumentRanges.instrumentName": CI}]});
}

musicTerm = "ts"_ beats:([1-9][0-9]?) _ beatType:([1-9][0-9]?)
{
	queryObj.$and.push(
    	{"timeSignatures": 
    		{"beats": parseInt(beats.join("", 10)), 
                 "beatType": parseInt(beatType.join("", 10))}
        });
}
/ "tempo" _ min:([0-9][0-9]?[0-9]?) _ max:([1-9][0-9]?[0-9]?)
{
	const minTempo = parseInt(min.join("", 10));
        const maxTempo = parseInt(max.join("", 10));
    
    if (minTempo < maxTempo)
    {
    	queryObj.$and.push({"minTempo": {$gte: minTempo}}, {"maxTempo": {$lte: maxTempo}});
    }
    else
    {
      expected("tempo range should be from low to high");
    }
}
/ "key" _ key:([a-gA-G][b|#]?)
{
	queryObj.$and.push({"keySignatures": key.join("")});
}
/ "dynamic" _ dynamic:
("ffffff"/"fffff"/"ffff"/"fff"/"ff"/"fp"/"fz"/"f"/"mf"/
"mp"/"pppppp"/"ppppp"/"pppp"/"ppp"/"pp"/"p"/"rfz"/
"rf"/"sfz"/"sffz"/"sfpp"/"sfp"/"sf")
{
  queryObj.$and.push({"dynamics": dynamic});
}
_ "whitespace"
  = [ \t\n\r]*

